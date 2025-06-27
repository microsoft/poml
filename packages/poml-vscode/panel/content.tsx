import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { PreviewResponse, WebviewState, WebviewUserOptions } from './types';
import { Message, RichContent } from 'poml';
import { Converter as MarkdownConverter } from 'showdown';
import { PlainSpan } from '../util/sourceMap';

type HeadlessPomlVscodePanelContentProps = WebviewUserOptions & PreviewResponse;

interface PomlVscodePanelContentProps extends WebviewState, HeadlessPomlVscodePanelContentProps {
  extensionResourcePath: (mediaFile: string) => string;
  localResourcePath: (resourceFile: string) => string;
}

function ButtonContent(props: { icon: string; content: string }) {
  const { icon, content } = props;
  return (
    <>
      <div className="avatar">
        <i className={`codicon codicon-${icon}`}></i>
      </div>
      <div className="content">{content}</div>
    </>
  );
}

function ToolBar(props: WebviewUserOptions) {
  const { speakerMode, displayFormat } = props;

  const applicableDisplayFormats = [
    { value: 'rendered', content: 'Rendered' },
    { value: 'plain', content: 'Plain Text' },
    { value: 'ir', content: 'IR (debug mode)' }
  ];

  return (
    <div className="toolbar">
      <div className="button oneclick" id="copy">
        <ButtonContent icon="copy" content="Copy" />
      </div>
      <div
        className={`button onoff ${speakerMode ? 'active' : ''}`}
        id="speaker-mode"
        data-value={speakerMode}
      >
        <ButtonContent icon="comment-discussion" content="Speaker Mode" />
      </div>
      <div className="button menu-selection" id="display-format" data-value={displayFormat}>
        <ButtonContent
          icon="code-oss"
          content={`Display: ${applicableDisplayFormats.find(val => val.value === displayFormat)?.content}`}
        />
        <div className="expand">
          <i className="codicon codicon-triangle-down"></i>
        </div>
        <div className="menu">
          {applicableDisplayFormats.map(item => (
            <div
              className={`item ${displayFormat === item.value ? 'selected' : ''}`}
              data-value={item.value}
              key={item.value}
            >
              <ButtonContent icon="check" content={item.content} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CodeBlock(props: { className?: string, content: RichContent }) {
  const { content, className } = props;
  if (typeof content === 'string') {
    return (
      <pre className={className}>
        <code>{content}</code>
      </pre>
    );
  } else {
    return (
      <pre className={className}>
        <code>{JSON.stringify(content, null, 2)}</code>
      </pre>
    );
  }
}

function Markdown(props: { content: RichContent }) {
  const converter = new MarkdownConverter({
    headerLevelStart: 2,
    strikethrough: true,
    tables: true,
    underline: true
  });

  const concatenatedMarkdown =
    typeof props.content === 'string'
      ? props.content
      : props.content
          .map(part => {
            if (typeof part === 'string') {
              return part;
            } else {
              const { type, base64, alt } = part;
              return `![${alt ?? ''}](data:${type};base64,${base64})`;
            }
          })
          .join('\n\n');

  return <div dangerouslySetInnerHTML={{ __html: converter.makeHtml(concatenatedMarkdown) }} />;
}

function PlainTextWithOffsets(props: { spans: PlainSpan[] }) {
  return (
    <pre>
      <code>
        {props.spans.map((span, idx) => (
          <span key={idx} data-offset={span.offset}>{span.text}</span>
        ))}
      </code>
    </pre>
  );
}

function ChatMessages(props: { messages: Message[]; toRender: boolean; offsets?: number[] }) {
  const { messages, toRender, offsets } = props;
  return messages.map((message, idx) => {
    let role: string = message.speaker;
    let icon = 'feedback';
    if (role === 'system') {
      role = 'System';
      icon = 'lightbulb';
    } else if (role === 'human') {
      role = 'Human';
      icon = 'account';
    } else if (role === 'ai') {
      role = 'AI';
      icon = 'robot';
    }
    const offsetAttr = offsets ? { 'data-offset': offsets[idx] } : {};
    return (
      <div className={`chat-message chat-message-${message.speaker}`} key={`message-${idx}`} {...offsetAttr}>
        <div className="chat-message-header">
          <div className="content">
            <div className="avatar">
              <div className={`codicon codicon-${icon}`}></div>
            </div>
            <h3 className="name">{role}</h3>
          </div>
          <div className="chat-message-toolbar">
            <div className="toolbar-item">
              <a
                className="codicon codicon-code"
                role="button"
                aria-label="Jump to Source Code"
              ></a>
              <span className="toolbar-tooltip">Source Code</span>
            </div>
            <div className="toolbar-item">
              <a
                className="codicon codicon-copy"
                role="button"
                aria-label="Copy"
                data-value={
                  typeof message.content === 'string'
                    ? message.content
                    : JSON.stringify(message.content, null, 2)
                }
              ></a>
              <span className="toolbar-tooltip">Copy</span>
            </div>
          </div>
        </div>
        <div className="chat-message-content">
          {toRender ? (
            <Markdown content={message.content} />
          ) : (
            <CodeBlock content={message.content} />
          )}
        </div>
      </div>
    );
  });
}

function Content(props: WebviewUserOptions & PreviewResponse) {
  let { displayFormat, ir, content } = props;

  let toCopy: string =
    typeof content === 'string'
      ? content
      : JSON.stringify(content, null, 2);
  let result: React.ReactElement;
  if (content.length > 0 && content[0].hasOwnProperty('speaker')) {
    content = content as Message[];
    const offsets = props.messageOffsets ?? [];
    if (displayFormat === 'ir') {
      result = <CodeBlock content={ir} />;
    } else if (displayFormat === 'plain') {
      result = <ChatMessages messages={content} toRender={false} offsets={offsets} />;
    } else if (displayFormat === 'rendered') {
      result = <ChatMessages messages={content} toRender={true} offsets={offsets} />;
    } else {
      result = <div>Invalid display format</div>;
    }
  } else {
    content = content as RichContent;
    if (displayFormat === 'ir') {
      result = <CodeBlock content={ir} />;
    } else if (displayFormat === 'plain') {
      const spans = props.plainSpans ?? [];
      result = <PlainTextWithOffsets spans={spans} />;
    } else if (displayFormat === 'rendered') {
      result = <Markdown content={content} />;
    } else {
      result = <div>Invalid display format</div>;
    }
  }

  return (
    <div className="main" id="content">
      <div className="hidden" id="copy-content" data-value={toCopy} />
      {result}
    </div>
  );
}

function Root(props: PomlVscodePanelContentProps) {
  const { extensionResourcePath, localResourcePath, ...state } = props;
  const nonce = new Date().getTime() + '' + new Date().getMilliseconds();

  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-type" content="text/html;charset=UTF-8" />
        <meta id="webview-state" data-state={JSON.stringify(props)} />
        <script src={extensionResourcePath('index.js')} nonce={nonce}></script>
        <link href={extensionResourcePath('style.css')} rel="stylesheet" nonce={nonce} />
        <link href={extensionResourcePath('codicons/codicon.css')} rel="stylesheet" nonce={nonce} />
        <base href={localResourcePath(state.source)} />
      </head>
      <body className="vscode-body">
        <ToolBar {...state} />
        <Content {...state} />
      </body>
    </html>
  );
}

export function pomlVscodePanelContent(config: PomlVscodePanelContentProps) {
  return renderToString(<Root {...config} />);
}

export function headlessPomlVscodePanelContent(config: HeadlessPomlVscodePanelContentProps) {
  return renderToString(<Content {...config} />);
}
