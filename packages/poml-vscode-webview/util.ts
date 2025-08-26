import { getState } from './state';

export interface MessagePoster {
  /**
   * Post a message to the poml extension
   */
  postMessage(type: string, body: object): void;

  /**
   * Post a command to be executed to the poml extension
   */
  postCommand(command: string, args: any[]): void;
}

/**
 * Poster is a class that allows sending messages to the extension
 * @param vscode Provided by the vscode API.
 * @returns The message poster class.
 */
export const createPosterForVsCode = (vscode: any) => {
  return new (class implements MessagePoster {
    postMessage(type: string, body: object): void {
      vscode.postMessage({
        type,
        source: getState().source,
        body,
      });
    }
    postCommand(command: string, args: any[]) {
      this.postMessage('command', { command, args });
    }
  })();
};
