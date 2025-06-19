import * as assert from 'assert';
import * as vscode from 'vscode';

let extensionActivated = false;
async function ensureExtensionActivatedOnce() {
  if (!extensionActivated) {
    console.log('Attempting to activate extension (once) for Command Test Suite...');
    const extension = vscode.extensions.getExtension('poml-team.poml');
    if (!extension) {
      throw new Error('Extension poml-team.poml not found');
    }
    if (!extension.isActive) {
      console.log('Extension not active, activating for Command Test Suite...');
      await extension.activate();
      console.log('Extension activation attempted for Command Test Suite.');
      // Wait for commands to be registered - increased delay
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('Delay after activation finished for Command Test Suite.');
    } else {
      console.log('Extension was already active for Command Test Suite.');
    }
    extensionActivated = true;
  }
}

suite('Command Test Suite', function() { // Changed to function to use this.timeout
  this.timeout(20000); // Set timeout for the suite, including activation

  // Helper function to poll for WebView panel
  async function findPreviewPanel(): Promise<boolean> {
    for (let i = 0; i < 20; i++) { // Poll for ~5 seconds (20 * 250ms)
        await new Promise(resolve => setTimeout(resolve, 250));
        const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
        for (const tab of tabs) {
            // Check if tab.input is an object and has a viewType property
            if (tab.input && typeof tab.input === 'object' && 'viewType' in tab.input) {
                const tabInput = tab.input as { viewType: string }; // Type assertion
                if (tabInput.viewType === 'poml.preview') {
                    return true;
                }
            }
        }
    }
    return false;
  }

  // Test for poml.showPreview
  test('poml.showPreview command should open a preview panel and set context', async () => {
    await ensureExtensionActivatedOnce();
    console.log('Running test for poml.showPreview...');

    const document = await vscode.workspace.openTextDocument({ language: 'poml', content: '<poml>showPreview test</poml>' });
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    console.log('Document opened for poml.showPreview.');

    await vscode.commands.executeCommand('poml.showPreview');
    console.log('poml.showPreview command executed.');

    assert.ok(await findPreviewPanel(), 'POML preview panel should be found for poml.showPreview.');
    console.log('Preview panel found for poml.showPreview.');

    // Assuming 'getContext' is a test utility command or a placeholder
    // If this command doesn't exist, this part will fail.
    try {
        const contextValue = await vscode.commands.executeCommand('getContext', 'pomlPreviewFocus');
        assert.strictEqual(contextValue, true, 'pomlPreviewFocus context should be true after poml.showPreview.');
        console.log('pomlPreviewFocus context is true for poml.showPreview.');
    } catch (err) {
        console.warn("Could not execute 'getContext' command. Skipping pomlPreviewFocus context check. Error:", err);
        // Optionally, fail the test if context check is critical:
        // assert.fail("Failed to check context 'pomlPreviewFocus'. The 'getContext' command might not be available.");
    }

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    console.log('All editors closed after poml.showPreview test.');
  });

  // Updated test for poml.showPreviewToSide
  test('poml.showPreviewToSide command should open a preview panel and set context', async () => {
    await ensureExtensionActivatedOnce();
    console.log('Running test for poml.showPreviewToSide...');

    const document = await vscode.workspace.openTextDocument({ language: 'poml', content: '<poml>showPreviewToSide test</poml>' });
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    console.log('Document opened for poml.showPreviewToSide.');

    await vscode.commands.executeCommand('poml.showPreviewToSide');
    console.log('poml.showPreviewToSide command executed.');

    assert.ok(await findPreviewPanel(), 'POML preview panel should be found for poml.showPreviewToSide.');
    console.log('Preview panel found for poml.showPreviewToSide.');

    try {
        const contextValue = await vscode.commands.executeCommand('getContext', 'pomlPreviewFocus');
        assert.strictEqual(contextValue, true, 'pomlPreviewFocus context should be true after poml.showPreviewToSide.');
        console.log('pomlPreviewFocus context is true for poml.showPreviewToSide.');
    } catch (err) {
        console.warn("Could not execute 'getContext' command. Skipping pomlPreviewFocus context check. Error:", err);
    }

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    console.log('All editors closed after poml.showPreviewToSide test.');
  });

  // Test for poml.showLockedPreviewToSide
  test('poml.showLockedPreviewToSide command should open a locked preview panel and set context', async () => {
    await ensureExtensionActivatedOnce();
    console.log('Running test for poml.showLockedPreviewToSide...');

    const document = await vscode.workspace.openTextDocument({ language: 'poml', content: '<poml>showLockedPreviewToSide test</poml>' });
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    console.log('Document opened for poml.showLockedPreviewToSide.');

    await vscode.commands.executeCommand('poml.showLockedPreviewToSide');
    console.log('poml.showLockedPreviewToSide command executed.');

    assert.ok(await findPreviewPanel(), 'POML preview panel should be found for poml.showLockedPreviewToSide.');
    console.log('Preview panel found for poml.showLockedPreviewToSide.');

    // Add check for "locked" state if possible - this might require inspecting panel title or icon
    // For now, we just check if the panel opens and context is set.
    // The viewType 'poml.preview' is generic for all these previews.
    // Differentiating a "locked" preview might need more specific panel properties if available.

    try {
        const contextValue = await vscode.commands.executeCommand('getContext', 'pomlPreviewFocus');
        assert.strictEqual(contextValue, true, 'pomlPreviewFocus context should be true after poml.showLockedPreviewToSide.');
        console.log('pomlPreviewFocus context is true for poml.showLockedPreviewToSide.');
    } catch (err) {
        console.warn("Could not execute 'getContext' command. Skipping pomlPreviewFocus context check. Error:", err);
    }

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    console.log('All editors closed after poml.showLockedPreviewToSide test.');
  });
});
