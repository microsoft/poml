/** One manager per POML compile (nested files do not count) */
export type Context<T> = { [key: string]: T };
export class ContextManager<T> {
  private contextStore: { [key: string]: T } = {};
  private stack: Array<{ [key: string]: T }> = [];

  public initialize(initialContext: { [key: string]: T }) {
    this.contextStore = { ...initialContext };
    this.stack = [];
  }

  public setGlobalVariable(key: string, value: T) {
    this.contextStore[key] = value;
  }

  public setLocalVariable(key: string, value: T) {
    if (this.stack.length === 0) {
      throw new Error('No local stack available');
    }
    this.stack[this.stack.length - 1][key] = value;
  }

  public pushStack(context: Context<T>) {
    this.stack.push({ ...context });
  }

  public popStack() {
    if (this.stack.length === 0) {
      throw new Error('No local stack to pop');
    }
    this.stack.pop();
  }
}
