import * as vscode from 'vscode';
import { getClient } from 'poml-vscode/extension';
import { PreviewMethodName, PreviewParams, PreviewResponse } from 'poml-vscode/panel/types';
import { Message } from 'poml';

export function registerPomlChatParticipant(context: vscode.ExtensionContext) {
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult | void> => {
    const files = request.references
      .map(ref => ref.value)
      .map(v => (v instanceof vscode.Location ? v.uri : v))
      .filter((v): v is vscode.Uri => v instanceof vscode.Uri);

    const docs = files.map(f => `  <document src="${f.toString()}" parser="txt" />`).join('\n');
    const markup = `<poml>\n  <task>${request.prompt}</task>\n  <cp caption="References">\n${docs}\n  </cp>\n</poml>`;

    const params: PreviewParams = {
      uri: 'inmemory://poml/chat.poml',
      text: markup,
      speakerMode: true,
      displayFormat: 'rendered'
    };
    const response: PreviewResponse = await getClient().sendRequest(PreviewMethodName, params);
    if (response.error) {
      stream.markdown(`Error rendering POML: ${response.error}`);
      return;
    }
    const messages = response.content as Message[];
    const chatMessages = messages.map(m => {
      const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return m.speaker === 'human'
        ? vscode.LanguageModelChatMessage.User(text)
        : vscode.LanguageModelChatMessage.Assistant(text);
    });

    const [model] = await vscode.lm.selectChatModels();
    if (!model) {
      stream.markdown('No chat model available.');
      return;
    }
    const chatResponse = await model.sendRequest(chatMessages, {}, token);
    for await (const part of chatResponse.text) {
      stream.markdown(part);
    }
    return {};
  };

  const participant = vscode.chat.createChatParticipant('poml.runner', handler);
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media/icon/poml-icon-16.svg');
  context.subscriptions.push(participant);
}
