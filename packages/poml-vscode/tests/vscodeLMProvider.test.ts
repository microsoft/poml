import * as assert from 'assert';
import * as vscode from 'vscode';
import { VSCodeLMProvider, VSCodeLMIntegration } from '../providers/vscodeLMProvider';

suite('VS Code Language Model Provider Tests', () => {
  
  suite('VSCodeLMProvider', () => {
    test('isAvailable should detect vscode.lm presence', () => {
      // This test checks if the isAvailable method works
      // In a real VS Code environment, this would check for vscode.lm
      const result = VSCodeLMProvider.isAvailable();
      assert.strictEqual(typeof result, 'boolean');
    });

    test('getInstance should return singleton instance', () => {
      const instance1 = VSCodeLMProvider.getInstance();
      const instance2 = VSCodeLMProvider.getInstance();
      assert.strictEqual(instance1, instance2);
    });

    test('getAvailableModels should return array', async () => {
      const provider = VSCodeLMProvider.getInstance();
      const models = await provider.getAvailableModels();
      assert.ok(Array.isArray(models));
    });
  });

  suite('VSCodeLMIntegration', () => {
    test('shouldUseVSCodeLM returns boolean', () => {
      const settings = {
        provider: 'vscode' as any,
        model: 'copilot/gpt-4o'
      };
      const result = VSCodeLMIntegration.shouldUseVSCodeLM(settings);
      assert.strictEqual(typeof result, 'boolean');
    });

    test('shouldUseVSCodeLM returns true for vscode provider', () => {
      const settings = {
        provider: 'vscode' as any,
        model: 'copilot/gpt-4o',
        apiKey: undefined
      };
      const result = VSCodeLMIntegration.shouldUseVSCodeLM(settings);
      assert.strictEqual(result, true);
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

    test('validate returns object with valid property', async () => {
      const result = await VSCodeLMIntegration.validate();
      assert.ok(typeof result === 'object');
      assert.ok('valid' in result);
      assert.strictEqual(typeof result.valid, 'boolean');
    });

    test('getAvailableModels returns array', async () => {
      const models = await VSCodeLMIntegration.getAvailableModels();
      assert.ok(Array.isArray(models));
    });
  });
});