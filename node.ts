export class Relation {
  constructor(
    public node: Node,
    public refColumnName: string,
    public refChildColumnName: string,
    public fkName: string | undefined = undefined,
  ) {}
}

export class Node {
  public parents: Relation[] = [];
  public children: Relation[] = [];

  constructor(public name: string) {}
}
