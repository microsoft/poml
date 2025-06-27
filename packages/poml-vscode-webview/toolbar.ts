import $ from 'jquery';
import { MessagePoster } from './util';
import { WebviewState, WebviewMessage, WebviewUserOptions } from '../poml-vscode/panel/types';
import { getState } from './state';
import { getEditorLineNumberForPageOffset, offsetToLine } from './scrollSync';

let toolbarUpdate: (() => void) | undefined = undefined;

export const setupToolbar = (vscode: any, messaging: MessagePoster) => {
  toolbarUpdate = function () {
    const form: WebviewUserOptions = {
      speakerMode: $('#speaker-mode').data('value') === true,
      displayFormat: $('#display-format').data('value')
    };
    const newState: WebviewState = { ...getState(), ...form };
    vscode.setState(newState);
    messaging.postMessage(WebviewMessage.Form, form);
  };

  $('#copy').on('click', function () {
    const copyText = $('#copy-content').attr('data-value') ?? '';
    navigator.clipboard.writeText(copyText);
  });

  $(document).on('click', '.chat-message-toolbar .codicon-copy', function () {
    const copyText = $(this).attr('data-value') ?? '';
    navigator.clipboard.writeText(copyText);
  });

  $(document).on('click', '.chat-message-toolbar .codicon-code', function () {
    const elem = $(this).closest('.chat-message')[0];
    const offsetAttr = elem ? elem.getAttribute('data-offset') : null;
    if (offsetAttr) {
      const offset = parseInt(offsetAttr, 10);
      if (!isNaN(offset)) {
        const line = offsetToLine(offset, (getState() as any).rawText);
        messaging.postMessage(WebviewMessage.DidClick, { line });
        return;
      }
    }
    const top = elem ? elem.getBoundingClientRect().top + window.scrollY : 0;
    const line = getEditorLineNumberForPageOffset(top);
    if (typeof line === 'number' && !isNaN(line)) {
      messaging.postMessage(WebviewMessage.DidClick, { line: Math.floor(line) });
    } else {
      messaging.postCommand('poml.showSource', []);
    }
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
};

window.addEventListener('message', e => {
  const message = e.data as any;
  if (message === undefined) {
    return;
  }
  if (message.type === WebviewMessage.UpdateContent) {
    $('#content').html(message.content);
  }
});
