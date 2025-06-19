import * as assert from 'assert';
import * as vscode from 'vscode';

let extensionActivated = false;
async function ensureExtensionActivatedOnce() {
  if (!extensionActivated) {
    console.log('Attempting to activate extension (once)...');
    const extension = vscode.extensions.getExtension('poml-team.poml');
    if (!extension) {
      throw new Error('Extension poml-team.poml not found');
    }
    if (!extension.isActive) {
      console.log('Extension not active, activating...');
      await extension.activate();
      console.log('Extension activation attempted.');
      // Wait for commands to be registered - increased delay
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('Delay after activation finished.');
    } else {
      console.log('Extension was already active.');
    }
    extensionActivated = true;
  }
}

suite('Extension Test Suite', function() { // Changed to function to use this.timeout
  this.timeout(20000); // Set timeout for the suite, including activation

  vscode.window.showInformationMessage('Start all tests in Extension Test Suite.');

  test('Sample test', async () => {
    await ensureExtensionActivatedOnce();
    console.log('Running "Sample test"...');
    const commands = await vscode.commands.getCommands(true);
    console.log('Available commands for Sample test:', commands.length); // Log command count
    assert.ok(commands.includes('poml.showPreviewToSide'), 'Command "poml.showPreviewToSide" should exist after activation.');
  });
});
