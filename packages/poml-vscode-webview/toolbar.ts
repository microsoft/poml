import $ from 'jquery';
import { MessagePoster } from './util';
import { WebviewState, WebviewMessage, WebviewUserOptions } from '../poml-vscode/panel/types';
import { getState, setCachedState } from './state';

/* The function to submit a toolbar configuration update. */
let toolbarUpdate: (() => void) | undefined = undefined;

/* Rerender chips when the user adds/removes context or stylesheet files.
   This is called when the backend sends an update to the webview to update the chip contents. */
let chipUpdate: (() => void) | undefined = undefined;

let vscodeApi: any = undefined;

function basename(p: string): string {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1];
}

function rerenderChips(options: WebviewUserOptions) {
  const contexts = options.contexts ?? [];
  const stylesheets = options.stylesheets ?? [];

  // Remove existing chips.
  $('#context-stylesheet-files .chip').remove();

  // Add the chips onto #context-stylesheet-files before the add buttons
  for (const file of contexts) {
    const chip = $('<span class="context chip chip-context tooltip-anchor"/>').attr('data-file', file);
    $('<span class="codicon codicon-file-symlink-file" />').appendTo(chip);
    $('<span class="content"></span>').text(basename(file)).appendTo(chip);
    $('<span class="remove codicon codicon-close"/>').appendTo(chip);
    $('<span class="tooltip tooltip-long"></span>')
      .text('Context: ' + file)
      .appendTo(chip);
    chip.appendTo($('#context-stylesheet-files'));
  }

  for (const file of stylesheets) {
    const chip = $('<span class="stylesheet chip chip-stylesheet tooltip-anchor"/>').attr('data-file', file);
    $('<span class="codicon codicon-symbol-color" />').appendTo(chip);
    $('<span class="content"></span>').text(basename(file)).appendTo(chip);
    $('<span class="remove codicon codicon-close"/>').appendTo(chip);
    $('<span class="tooltip tooltip-long"></span>')
      .text('Stylesheet: ' + file)
      .appendTo(chip);
    chip.appendTo($('#context-stylesheet-files'));
  }

  $('<span class="chip add" id="add-context"/>')
    .append('<span class="codicon codicon-plus"></span>')
    .append('<span class="content">Add Context...</span>')
    .appendTo($('#context-stylesheet-files'));

  $('<span class="chip add" id="add-stylesheet"/>')
    .append('<span class="codicon codicon-plus"></span>')
    .append('<span class="content">Add Stylesheet...</span>')
    .appendTo($('#context-stylesheet-files'));

  $('#context-stylesheet .badge')
    .text(contexts.length + stylesheets.length)
    .toggleClass('hidden', contexts.length + stylesheets.length === 0);
}

/* This function is called once to set up the toolbar and its event handlers. */
export const setupToolbar = (vscode: any, messaging: MessagePoster) => {
  vscodeApi = vscode;
  toolbarUpdate = function () {
    const form: any = {
      speakerMode: $('#speaker-mode').data('value') === true,
      displayFormat: $('#display-format').data('value'),
    };
    const newState: WebviewState = { ...getState(), ...form };
    vscode.setState(newState);
    setCachedState(newState);
    messaging.postMessage(WebviewMessage.Form, form);
  };

  chipUpdate = function () {
    rerenderChips(getState());
  };

  /* ------------------------------------------------------------------ */
  /* Delegated click-handlers (registered ONCE)                         */
  /* ------------------------------------------------------------------ */

  $(document)
    // Add context / stylesheet
    .off('click', '#add-context')
    .on('click', '#add-context', () => messaging.postCommand('poml.addContextFile', []))
    .off('click', '#add-stylesheet')
    .on('click', '#add-stylesheet', () => messaging.postCommand('poml.addStylesheetFile', []))
    // Remove context / stylesheet
    .off('click', '.context .remove')
    .on('click', '.context .remove', function () {
      const file = $(this).parent().data('file');
      messaging.postCommand('poml.removeContextFile', [file]);
    })
    .off('click', '.stylesheet .remove')
    .on('click', '.stylesheet .remove', function () {
      const file = $(this).parent().data('file');
      messaging.postCommand('poml.removeStylesheetFile', [file]);
    });

  /* ------------------------------------------------------------------ */
  /* One-time toolbar button handlers                                   */
  /* ------------------------------------------------------------------ */

  $('#copy').on('click', function () {
    const copyText = $('#copy-content').attr('data-value') ?? '';
    navigator.clipboard.writeText(copyText);
  });

  $('#context-stylesheet').on('click', function () {
    $('#context-stylesheet-files').toggleClass('hidden');
  });

  $(document).on('click', '.chat-message-toolbar .codicon-copy', function () {
    const copyText = $(this).attr('data-value') ?? '';
    navigator.clipboard.writeText(copyText);
  });

  $(document).on('click', '.chat-message-toolbar .codicon-code', function () {
    const line = parseInt($(this).data('line'));
    if (!isNaN(line)) {
      messaging.postMessage(WebviewMessage.DidClick, { line });
    }
  });

  $(document).on('dblclick', '[data-line]', function (e) {
    // Stop the event from bubbling up to parent elements that also match '[data-line]'.
    // This ensures the code inside only runs ONCE for the innermost element clicked.
    e.stopPropagation();

    if (!getState().doubleClickToSwitchToEditor) {
      return;
    }

    const line = $(this).attr('data-line');
    if (line) {
      const num = parseInt(line, 10);
      if (!isNaN(num)) {
        messaging.postMessage(WebviewMessage.DidClick, { line: num });

        // Prevent the browser's default double-click action (e.g., selecting text).
        e.preventDefault();
      }
    }
  });

  $('.toolbar .button.onoff').on('click', function () {
    $(this).toggleClass('active');
    $(this).data('value', $(this).hasClass('active'));
    toolbarUpdate?.();
  });

  $('.toolbar .button.menu-selection').on('click', function (e) {
    e.stopPropagation();
    $(this).toggleClass('active');
  });
  $('.button.menu-selection .menu .item').on('click', function (e) {
    const button = $(this).closest('.button.menu-selection');
    button.data('value', $(this).data('value')).attr('data-value', $(this).data('value'));
    button.find('> .content').text('Display: ' + $(this).find('.content').text());
    button.find('.menu .item').removeClass('selected');
    $(this).addClass('selected');
    button.removeClass('active');
    e.stopPropagation();
    toolbarUpdate?.();
  });
  $(document).on('click', function () {
    $('.toolbar .button.menu-selection').removeClass('active');
  });

  chipUpdate?.(); // initial render
};

/* -------------------------------------------------------------------- */
/* Handle messages from the extension                                   */
/* -------------------------------------------------------------------- */
window.addEventListener('message', (e) => {
  const message = e.data as any;
  if (message === undefined) {
    return;
  }
  if (message.type === WebviewMessage.UpdateContent) {
    $('#content').replaceWith(message.content);
  }
  if (message.type === WebviewMessage.UpdateUserOptions) {
    // The contexts and stylesheets are updated from the server side,
    // though the update is initially initiated by the client side.
    const newState: WebviewState = { ...getState(), ...message.options };
    vscodeApi?.setState(newState);
    setCachedState(newState);
    chipUpdate?.();
  }
});
