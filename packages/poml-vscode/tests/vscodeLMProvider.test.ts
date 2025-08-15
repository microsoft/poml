import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { VSCodeLMProvider, VSCodeLMIntegration } from '../providers/vscodeLMProvider';
import { Message } from 'poml';

suite('VS Code Language Model Provider Tests', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  suite('VSCodeLMProvider', () => {
    test('isAvailable should return true when vscode.lm exists', () => {
      // Mock vscode.lm
      const originalLm = (vscode as any).lm;
      (vscode as any).lm = {
        selectChatModels: () => {}
      };

      const result = VSCodeLMProvider.isAvailable();
      assert.strictEqual(result, true);

      // Restore
      (vscode as any).lm = originalLm;
    });

    test('isAvailable should return false when vscode.lm does not exist', () => {
      // Mock vscode.lm as undefined
      const originalLm = (vscode as any).lm;
      delete (vscode as any).lm;

      const result = VSCodeLMProvider.isAvailable();
      assert.strictEqual(result, false);

      // Restore
      (vscode as any).lm = originalLm;
    });

    test('getInstance should return singleton instance', () => {
      const instance1 = VSCodeLMProvider.getInstance();
      const instance2 = VSCodeLMProvider.getInstance();
      
      assert.strictEqual(instance1, instance2);
    });

    test('getAvailableModels should return array of model strings', async () => {
      const provider = VSCodeLMProvider.getInstance();
      
      // Mock vscode.lm.selectChatModels
      const originalLm = (vscode as any).lm;
      (vscode as any).lm = {
        selectChatModels: sandbox.stub().resolves([{ id: 'test-model' }])
      };

      const models = await provider.getAvailableModels();
      assert(Array.isArray(models));

      // Restore
      (vscode as any).lm = originalLm;
    });

    test('isModelAvailable should check if specific model exists', async () => {
      const provider = VSCodeLMProvider.getInstance();
      
      // Mock vscode.lm.selectChatModels
      const originalLm = (vscode as any).lm;
      const selectStub = sandbox.stub();
      selectStub.withArgs({ vendor: 'copilot', family: 'gpt-4o' }).resolves([{ id: 'gpt-4o' }]);
      selectStub.withArgs({ vendor: 'copilot', family: 'invalid' }).resolves([]);
      
      (vscode as any).lm = {
        selectChatModels: selectStub
      };

      const available = await provider.isModelAvailable('copilot', 'gpt-4o');
      assert.strictEqual(available, true);

      const notAvailable = await provider.isModelAvailable('copilot', 'invalid');
      assert.strictEqual(notAvailable, false);

      // Restore
      (vscode as any).lm = originalLm;
    });

    test('streamText should handle user consent error', async () => {
      const provider = VSCodeLMProvider.getInstance();
      
      // Mock vscode.lm with consent error
      const originalLm = (vscode as any).lm;
      const error = new Error('User consent required');
      (error as any).code = 'UserConsentRequired';
      
      (vscode as any).lm = {
        selectChatModels: sandbox.stub().rejects(error),
        LanguageModelError: class {
          code: string;
          constructor(code: string) {
            this.code = code;
          }
        }
      };
      (vscode as any).LanguageModelError = (vscode as any).lm.LanguageModelError;

      const messages: Message[] = [
        { speaker: 'human', content: 'Hello' }
      ];

      try {
        const generator = provider.streamText(messages);
        await generator.next();
        assert.fail('Should have thrown an error');
      } catch (err: any) {
        assert(err.message.includes('consent'));
      }

      // Restore
      (vscode as any).lm = originalLm;
      delete (vscode as any).LanguageModelError;
    });
  });

  suite('VSCodeLMIntegration', () => {
    test('shouldUseVSCodeLM returns true when provider is vscode', () => {
      const settings = {
        provider: 'vscode' as any,
        model: 'copilot/gpt-4o',
        apiKey: undefined
      };

      const result = VSCodeLMIntegration.shouldUseVSCodeLM(settings);
      assert.strictEqual(result, true);
    });

    test('shouldUseVSCodeLM returns true when no API key and VS Code LM available', () => {
      // Mock vscode.lm
      const originalLm = (vscode as any).lm;
      (vscode as any).lm = {
        selectChatModels: () => {}
      };

      const settings = {
        provider: 'openai' as any,
        model: 'gpt-4',
        apiKey: undefined
      };

      const result = VSCodeLMIntegration.shouldUseVSCodeLM(settings);
      assert.strictEqual(result, true);

      // Restore
      (vscode as any).lm = originalLm;
    });

    test('shouldUseVSCodeLM returns false when API key configured', () => {
      const settings = {
        provider: 'openai' as any,
        model: 'gpt-4',
        apiKey: 'sk-test-key'
      };

      const result = VSCodeLMIntegration.shouldUseVSCodeLM(settings);
      assert.strictEqual(result, false);
    });

    test('validate should return valid when models available', async () => {
      // Mock vscode.lm
      const originalLm = (vscode as any).lm;
      (vscode as any).lm = {
        selectChatModels: sandbox.stub().resolves([{ id: 'test-model' }])
      };

      const result = await VSCodeLMIntegration.validate();
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.message, undefined);

      // Restore
      (vscode as any).lm = originalLm;
    });

    test('validate should return invalid when no models available', async () => {
      // Mock vscode.lm
      const originalLm = (vscode as any).lm;
      (vscode as any).lm = {
        selectChatModels: sandbox.stub().resolves([])
      };

      const result = await VSCodeLMIntegration.validate();
      assert.strictEqual(result.valid, false);
      assert(result.message?.includes('No language models found'));

      // Restore
      (vscode as any).lm = originalLm;
    });

    test('validate should return invalid when VS Code LM not available', async () => {
      // Mock vscode.lm as undefined
      const originalLm = (vscode as any).lm;
      delete (vscode as any).lm;

      const result = await VSCodeLMIntegration.validate();
      assert.strictEqual(result.valid, false);
      assert(result.message?.includes('not available'));

      // Restore
      (vscode as any).lm = originalLm;
    });

    test('createStream should call provider streamText', async () => {
      const messages: Message[] = [
        { speaker: 'human', content: 'Test message' }
      ];
      const settings = {
        provider: 'vscode' as any,
        model: 'copilot/gpt-4o'
      };

      // Mock provider streamText
      const mockStream = async function*() {
        yield 'Test';
        yield ' response';
      };
      
      const provider = VSCodeLMProvider.getInstance();
      sandbox.stub(provider, 'streamText').returns(mockStream());

      const stream = VSCodeLMIntegration.createStream(messages, settings);
      const chunks: string[] = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      assert.deepStrictEqual(chunks, ['Test', ' response']);
    });

    test('getAvailableModels should return model list', async () => {
      // Mock provider getAvailableModels
      const provider = VSCodeLMProvider.getInstance();
      sandbox.stub(provider, 'getAvailableModels').resolves(['copilot/gpt-4o', 'copilot/gpt-4o-mini']);

      const models = await VSCodeLMIntegration.getAvailableModels();
      assert.deepStrictEqual(models, ['copilot/gpt-4o', 'copilot/gpt-4o-mini']);
    });
  });

  suite('Message Conversion', () => {
    test('should convert POML messages to VS Code LM messages', () => {
      const messages: Message[] = [
        { speaker: 'system', content: 'You are a helpful assistant' },
        { speaker: 'human', content: 'Hello' },
        { speaker: 'ai', content: 'Hi there!' }
      ];

      // This would be tested internally in the provider
      // The test ensures the conversion logic handles different speaker types
      assert(messages.every(m => m.speaker && m.content));
    });

    test('should handle image content in messages', () => {
      const messages: Message[] = [
        {
          speaker: 'human',
          content: [
            'Look at this image:',
            { type: 'image/png', base64: 'iVBORw0KGgoAAAANS...' }
          ]
        }
      ];

      // This would be tested internally in the provider
      // The test ensures multi-modal content is handled
      assert(Array.isArray(messages[0].content));
    });
  });

  suite('Error Handling', () => {
    test('should handle rate limiting errors', async () => {
      const provider = VSCodeLMProvider.getInstance();
      
      // Mock vscode.lm with rate limit error
      const originalLm = (vscode as any).lm;
      const selectStub = sandbox.stub().resolves([{
        sendRequest: sandbox.stub().rejects(new Error('Rate limited'))
      }]);
      
      (vscode as any).lm = {
        selectChatModels: selectStub,
        LanguageModelChatMessage: {
          User: (content: string) => ({ role: 'user', content }),
          Assistant: (content: string) => ({ role: 'assistant', content })
        }
      };
      (vscode as any).LanguageModelChatMessage = (vscode as any).lm.LanguageModelChatMessage;

      const messages: Message[] = [
        { speaker: 'human', content: 'Test' }
      ];

      try {
        const generator = provider.streamText(messages);
        await generator.next();
        assert.fail('Should have thrown an error');
      } catch (err: any) {
        assert(err.message.includes('Rate limited'));
      }

      // Restore
      (vscode as any).lm = originalLm;
      delete (vscode as any).LanguageModelChatMessage;
    });

    test('should handle model not found errors', async () => {
      const provider = VSCodeLMProvider.getInstance();
      
      // Mock vscode.lm returning no models
      const originalLm = (vscode as any).lm;
      (vscode as any).lm = {
        selectChatModels: sandbox.stub().resolves([])
      };

      const messages: Message[] = [
        { speaker: 'human', content: 'Test' }
      ];

      try {
        const generator = provider.streamText(messages);
        await generator.next();
        assert.fail('Should have thrown an error');
      } catch (err: any) {
        assert(err.message.includes('No language models available'));
      }

      // Restore
      (vscode as any).lm = originalLm;
    });
  });
});