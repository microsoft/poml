export class ContextEvaluator {
  private contextStore: { [key: string]: any } = {};
  private stack: Array<{ [key: string]: any }> = [];

  public setGlobalVariable(key: string, value: any) {
    this.contextStore[key] = value;
  }

  public setLocalVariable(key: string, value: any) {
    if (this.stack.length === 0) {
      throw new Error('No local stack available');
    }
    this.stack[this.stack.length - 1][key] = value;
  }

  public pushStack() {}
}
