import { describe, test, expect, jest } from '@jest/globals';
import path from 'path';
import { pathToFileURL } from 'url';

jest.mock('vscode-languageserver/node', () => ({
  createConnection: () => ({
    onInitialize: jest.fn(),
    onHover: jest.fn(),
    onCompletion: jest.fn(),
    onCompletionResolve: jest.fn(),
    languages: { diagnostics: { on: jest.fn() } },
    onRequest: jest.fn(),
    sendNotification: jest.fn(),
    sendDiagnostics: jest.fn(),
    listen: jest.fn()
  }),
  TextDocuments: jest.fn(() => ({ listen: jest.fn() })),
  ProposedFeatures: { all: {} },
  TextDocumentSyncKind: { Incremental: 1 },
  DocumentDiagnosticReportKind: { Full: 1, Unchanged: 2 }
}));

import { PomlLspServer } from 'poml-vscode/lsp/server';
import { computeMessageOffsets, computePlainSpans } from 'poml-vscode/util/sourceMap';
import { PreviewParams } from 'poml-vscode/panel/types';


describe('language server preview', () => {
  test('preview response includes source mappings', async () => {
    const server = new PomlLspServer();
    const absPath = path.resolve('test.poml');
    const fileUri = pathToFileURL(absPath).toString();
    const params: PreviewParams = {
      uri: fileUri,
      text: '<p><p speaker="ai">hello</p><p speaker="human">world</p></p>',
      speakerMode: true,
      displayFormat: 'rendered'
    };
    const response = await (server as any).computePreviewResponse(params);
    const expectedOffsets = computeMessageOffsets(response.ir);
    const expectedSpans = computePlainSpans(response.ir);
    expect(response.messageOffsets).toEqual(expectedOffsets);
    expect(response.plainSpans).toEqual(expectedSpans);
  });
});
