import $ from 'jquery';
import { MessagePoster } from './util';
import { WebviewState, WebviewMessage, WebviewUserOptions } from '../poml-vscode/panel/types';
import { getState } from './state';

let toolbarUpdate: (() => void) | undefined = undefined;
let vscodeApi: any = undefined;

function basename(p: string): string {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1];
}

function updateChips(options: WebviewUserOptions) {
  const contexts = options.contexts ?? [];
  const stylesheets = options.stylesheets ?? [];
  const contextContainer = $('#context-chips').empty();
  const stylesheetContainer = $('#stylesheet-chips').empty();

  for (const file of contexts) {
    const chip = $('<span class="chip"/>').attr('data-file', file);
    chip.text(basename(file));
    $('<span class="remove codicon codicon-close"/>').appendTo(chip);
    contextContainer.append(chip);
  }

  for (const file of stylesheets) {
    const chip = $('<span class="chip"/>').attr('data-file', file);
    chip.text(basename(file));
    $('<span class="remove codicon codicon-close"/>').appendTo(chip);
    stylesheetContainer.append(chip);
  }
}

export const setupToolbar = (vscode: any, messaging: MessagePoster) => {
  vscodeApi = vscode;
  toolbarUpdate = function () {
    const form: WebviewUserOptions = {
      speakerMode: $('#speaker-mode').data('value') === true,
      displayFormat: $('#display-format').data('value'),
      contexts: $('#context-chips .chip')
        .map(function () {
          return $(this).data('file');
        })
        .get(),
      stylesheets: $('#stylesheet-chips .chip')
        .map(function () {
          return $(this).data('file');
        })
        .get(),
    };
    const newState: WebviewState = { ...getState(), ...form };
    vscode.setState(newState);
    messaging.postMessage(WebviewMessage.Form, form);
  };

  $('#copy').on('click', function () {
    const copyText = $('#copy-content').attr('data-value') ?? '';
    navigator.clipboard.writeText(copyText);
  });

  $('#add-context').on('click', function () {
    messaging.postCommand('poml.addContextFile', []);
  });

  $('#add-stylesheet').on('click', function () {
    messaging.postCommand('poml.addStylesheetFile', []);
  });

  $(document).on('click', '#context-chips .remove', function () {
    const file = $(this).parent().data('file');
    messaging.postCommand('poml.removeContextFile', [file]);
  });

  $(document).on('click', '#stylesheet-chips .remove', function () {
    const file = $(this).parent().data('file');
    messaging.postCommand('poml.removeStylesheetFile', [file]);
  });

  $(document).on('click', '.chat-message-toolbar .codicon-copy', function () {
    const copyText = $(this).attr('data-value') ?? '';
    navigator.clipboard.writeText(copyText);
  });

  $('.toolbar .button.onoff').on('click', function () {
    $(this).toggleClass('active');
    $(this).data('value', $(this).hasClass('active'));
    if (toolbarUpdate) {
      toolbarUpdate();
    }
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
    if (toolbarUpdate) {
      toolbarUpdate();
    }
  });
  $(document).on('click', function () {
    $('.toolbar .button.menu-selection').removeClass('active');
  });

  updateChips(getState());
};

window.addEventListener('message', e => {
  const message = e.data as any;
  if (message === undefined) {
    return;
  }
  if (message.type === WebviewMessage.UpdateContent) {
    $('#content').html(message.content);
  }
  if (message.type === WebviewMessage.UpdateUserOptions) {
    const newState: WebviewState = { ...getState(), ...message.options };
    vscodeApi?.setState(newState);
    updateChips(message.options);
  }
});
