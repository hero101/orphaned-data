import { datasource } from './migration.config';
import { Node, Relation, RelationType } from './node';

type DataType = {
  parent: string;
  refChildId: string;
  child: string;
  childId: string;
  constraint: string;
};

export function toCamelCase(str: string): string {
  return str.replace(/([-_][a-z])/g, (group) =>
    group.toUpperCase().replace('-', '').replace('_', '')
  );
}

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

  // console.log('typeof rows:', rows[0]);

  const tables = (await queryRunner.getTables()).filter(
    (table) => table.database === 'alkemio'
  );

  const nodeMap: Map<string, Node> = new Map(
    tables.map((table) => [table.name, new Node(table.name)])
  );

  for (const table of tables) {
    for (const foreignKey of table.foreignKeys) {
      const parent = nodeMap.get(table.name);

      if (!parent) {
        throw new Error(`Node '${table.name}' not found`);
      }

      const child = nodeMap.get(foreignKey.referencedTableName);

      if (!child) {
        throw new Error(`Node '${foreignKey.referencedTableName}' not found`);
      }

      const index = table.indices.find((index) =>
        index.columnNames.includes(foreignKey.columnNames[0])
      );
      if (index?.isUnique) {
        child.parents.push(
          new Relation(
            parent,
            foreignKey.columnNames[0],
            foreignKey.referencedColumnNames[0],
            foreignKey?.name,
            RelationType.OneToOne
          )
        );
        parent.children.push(
          new Relation(
            child,
            foreignKey.referencedColumnNames[0],
            foreignKey.columnNames[0],
            foreignKey?.name,
            RelationType.OneToOne
          )
        );
      } else {
        parent.parents.push(
          new Relation(
            child,
            foreignKey.referencedColumnNames[0],
            foreignKey.columnNames[0],
            foreignKey?.name,
            RelationType.OneToMany
          )
        );
        child.children.push(
          new Relation(
            parent,
            foreignKey.columnNames[0],
            foreignKey.referencedColumnNames[0],
            foreignKey?.name,
            RelationType.ManyToOne
          )
        );
      }
    }
  }

  // console.log('\n\n-------------context parents-----------');
  // nodeMap.get('context')?.parents.forEach((parent) => {
  //   console.log('node nama :', parent.node.name);
  //   console.log('refColumnName :', parent.refColumnName);
  //   console.log('refChildColumnName :', parent.refChildColumnName);
  //   console.log('fkName :', parent.fkName);
  //   console.log('=====================');
  // });
  // console.log('\n\n-------------context children-----------');
  // nodeMap.get('context')?.children.forEach((child) => {
  //   console.log('node nama :', child.node.name);
  //   console.log('refColumnName :', child.refColumnName);
  //   console.log('refChildColumnName :', child.refChildColumnName);
  //   console.log('fkName :', child.fkName);
  //   console.log('=====================');
  // });
  // console.log('-------------credential parents-----------');
  // nodeMap.get('credential')?.parents.forEach((parent) => {
  //   console.log('node nama :', parent.node.name);
  //   console.log('refColumnName :', parent.refColumnName);
  //   console.log('refChildColumnName :', parent.refChildColumnName);
  //   console.log('fkName :', parent.fkName);
  //   console.log('=====================');
  // });
  // console.log('-------------credential children-----------');
  // nodeMap.get('credential')?.children.forEach((child) => {
  //   console.log('node nama :', child.node.name);
  //   console.log('refColumnName :', child.refColumnName);
  //   console.log('refChildColumnName :', child.refChildColumnName);
  //   console.log('fkName :', child.fkName);
  //   console.log('=====================');
  // });
  // console.log('-------------callout_framing parents-----------');
  // nodeMap.get('callout_framing')?.parents.forEach((parent) => {
  //   console.log('node nama :', parent.node.name);
  //   console.log('refColumnName :', parent.refColumnName);
  //   console.log('refChildColumnName :', parent.refChildColumnName);
  //   console.log('fkName :', parent.fkName);
  //   console.log('=====================');
  // });
  // console.log('-------------callout_framing children-----------');
  // nodeMap.get('callout_framing')?.children.forEach((child) => {
  //   console.log('node nama :', child.node.name);
  //   console.log('refColumnName :', child.refColumnName);
  //   console.log('refChildColumnName :', child.refChildColumnName);
  //   console.log('fkName :', child.fkName);
  //   console.log('=====================');
  // });
  // console.log('\n\n-------------user parents-----------');
  // nodeMap.get('user')?.parents.forEach((parent) => {
  //   console.log('node nama :', parent.node.name);
  //   console.log('refColumnName :', parent.refColumnName);
  //   console.log('refChildColumnName :', parent.refChildColumnName);
  //   console.log('fkName :', parent.fkName);
  //   console.log('=====================');
  // });
  // console.log('\n\n-------------user children-----------');
  // nodeMap.get('user')?.children.forEach((child) => {
  //   console.log('node nama :', child.node.name);
  //   console.log('refColumnName :', child.refColumnName);
  //   console.log('refChildColumnName :', child.refChildColumnName);
  //   console.log('fkName :', child.fkName);
  //   console.log('=====================');
  // });

  console.log(nodeMap);

  // return;

  // const tablesToInclude: string[] = ['user'];
  // const fitleredTables = tables.filter((table) =>
  //   tablesToInclude.includes(table.name)
  // );
  const tablesToSkip: string[] = ['user'];
  const fitleredTables = tables.filter(
    (table) => !tablesToSkip.includes(table.name)
  );

  let totalEntitiesRemoved: number = 0;

  for (const table of fitleredTables) {
    console.log('Processiong table:', table.name);
    // Generate the SQL query to find orphaned data
    let orphanedDataQuery = `SELECT * FROM ${table.name} WHERE `;
    const parentRelations = nodeMap.get(table.name)?.parents;
    const childRelations = nodeMap.get(table.name)?.children;

    if (!parentRelations || !childRelations) continue;

    if (parentRelations.length === 0 && childRelations.length === 0) continue;

    for (const fk of parentRelations) {
      orphanedDataQuery += `${table.name}.${fk.refChildColumnName} NOT IN (SELECT ${fk.refColumnName} FROM ${fk.node.name}) AND `;
    }

    for (const fk of childRelations) {
      if (fk.refColumnName !== toCamelCase(table.name) + 'Id') continue;
      orphanedDataQuery += `${table.name}.${fk.refChildColumnName} NOT IN (SELECT ${fk.refColumnName} FROM ${fk.node.name}) AND `;
    }
    orphanedDataQuery = orphanedDataQuery.slice(0, -5);
    console.log(orphanedDataQuery);

    if (orphanedDataQuery.endsWith('W')) {
      console.log(`No orphaned data found in table ${table.name}`);
      continue;
    }

    // Find any orphaned data
    const orphanedData: any[] = await queryRunner.query(orphanedDataQuery);

    // Delete any orphaned data
    // for (const row of orphanedData) {
    //   try {
    //     await queryRunner.query(
    //       `
    //         DELETE FROM ${table.name}
    //         WHERE id = ?
    //       `,
    //       [row.id]
    //     );
    //   } catch (error) {
    //     console.error(
    //       `Failed to delete orphaned data with id ${row.id} from table ${table.name}.`,
    //       error
    //     );
    //   }
    // }
    totalEntitiesRemoved += orphanedData.length;
    if (orphanedData.length > 0)
      console.log(
        `\n\nDeleted ${orphanedData.length} orphaned data from table ${table.name}`
      );
    console.log('=====================');
  }

  console.log('\n\n\n');
  console.log(`Total orphaned entities removed: ${totalEntitiesRemoved}`);
  console.log('=====================');
})();
