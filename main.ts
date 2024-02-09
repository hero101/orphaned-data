import { datasource } from "./migration.config";
import {Node, Relation} from "./node";

type DataType = {
  parent: string;
  refChildId: string;
  child: string;
  childId: string;
  constraint: string;
};


(async () => {
  await datasource.initialize();
  const queryRunner = datasource.createQueryRunner();
  await queryRunner.connect();

  // const rows: DataType[] = await queryRunner.query(`
  //   SELECT
  //     TABLE_NAME as parent,
  //     COLUMN_NAME as refChildId,
  //     REFERENCED_TABLE_NAME as child,
  //     REFERENCED_COLUMN_NAME as childId,
  //     CONSTRAINT_NAME as 'constraint'
  //   FROM
  //       INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  //   WHERE
  //       REFERENCED_TABLE_SCHEMA = 'alkemio' AND
  //       REFERENCED_TABLE_NAME IS NOT NULL;
  // `);

  const tables = (await queryRunner.getTables()).filter(table => table.database === 'alkemio');

  const nodeList: Node[] = tables.map(table => new Node(table.name));

  for (const table of tables) {
    for (const foreignKey of table.foreignKeys) {
      const parent = nodeList.find(nodeInList => nodeInList.name === table.name);

      if (!parent) {
        throw new Error(`Node '${table.name}' not found`);
      }

      const child = nodeList.find(node => node.name === foreignKey.referencedTableName);

      if (!child) {
        throw new Error(`Node '${foreignKey.referencedTableName}' not found`);
      }

      const index = table.indices.find(index => index.columnNames.includes(foreignKey.columnNames[0]));
      if (index?.isUnique) {
        child.parents.push(new Relation(parent, foreignKey.columnNames[0], foreignKey.referencedColumnNames[0], foreignKey?.name));
        parent.children.push(new Relation(child, foreignKey.referencedColumnNames[0], foreignKey.columnNames[0], foreignKey?.name));
      } else {
        child.children.push(new Relation(parent, foreignKey.columnNames[0], foreignKey.referencedColumnNames[0], foreignKey?.name));
        parent.parents.push(new Relation(child, foreignKey.referencedColumnNames[0], foreignKey.columnNames[0], foreignKey?.name));
      }
    }
  }

  console.log(nodeList);
})();
