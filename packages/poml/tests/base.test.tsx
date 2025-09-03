import * as React from 'react';
import {
  component,
  StyleSheetProvider,
  PomlComponent,
  unregisterComponent,
  listComponents,
  findComponentByAlias,
  findComponentByAliasOrUndefined,
  BufferCollection,
} from 'poml/base';
import { read } from 'poml';
import { describe, expect, test } from '@jest/globals';

test('component', async () => {
  const App = component('App', ['app1'])(() => {
    return <div>123</div>;
  });
  expect(await read(<App />)).toBe('<div>123</div>');
  unregisterComponent('App');
});

test('parameters', () => {
  expect(
    findComponentByAliasOrUndefined('question')!
      .mro()
      .map((c) => c.name),
  ).toEqual(['Paragraph', 'Text']);

  expect(
    findComponentByAliasOrUndefined('table')!
      .parameters()
      .map((p) => p.name),
  ).toEqual([
    'syntax',
    'records',
    'columns',
    'src',
    'parser',
    'selectedColumns',
    'selectedRecords',
    'maxRecords',
    'maxColumns',
    'className',
    'speaker',
    'writerOptions',
    'whiteSpace',
    'charLimit',
    'tokenLimit',
    'priority',
  ]);
});

test('computeStylesLegacy', () => {
  const AppInner = (props: any) => {
    const { component, customStyle, expectStyle, children } = props;
    const fakeComponent = new PomlComponent(component, undefined, {
      aliases: [component],
      unwantedProps: [],
      requiredProps: [],
      applyStyleSheet: true,
      asynchorous: false,
    });
    const style = fakeComponent.style(customStyle);
    expect(style).toEqual(expectStyle);
    if (children) {
      return <>{children}</>;
    } else {
      return <p>hahaha</p>;
    }
  };
  const App = ({ component, customStyle, expectStyle, children }: any) => {
    const stylesheet = {
      '*': {
        color: 'red',
      },
      'table': {
        color: 'blue',
        header: {
          color: 'green',
        },
      },
    };
    if (children) {
      return (
        <StyleSheetProvider stylesheet={stylesheet}>
          <AppInner component={component} customStyle={customStyle} expectStyle={expectStyle}>
            {children}
          </AppInner>
        </StyleSheetProvider>
      );
    } else {
      return (
        <StyleSheetProvider stylesheet={stylesheet}>
          <AppInner component={component} customStyle={customStyle} expectStyle={expectStyle} />
        </StyleSheetProvider>
      );
    }
  };

  read(
    <App
      component='table'
      customStyle={{ padding: 10 }}
      expectStyle={{ color: 'blue', padding: 10, header: { color: 'green' } }}
    />,
  );
  read(<App component='header' customStyle={{ padding: 10 }} expectStyle={{ color: 'red', padding: 10 }} />);
  read(
    <App
      component='table'
      customStyle={{ color: 'white' }}
      expectStyle={{ color: 'white', header: { color: 'green' } }}
    />,
  );
  read(<App component='base' customStyle={{ padding: 10 }} expectStyle={{ color: 'red', padding: 10 }} />);

  read(
    <App
      component='table'
      customStyle={{ padding: 10 }}
      expectStyle={{ color: 'blue', padding: 10, header: { color: 'green' } }}>
      <App component='header' customStyle={{ padding: 20 }} expectStyle={{ color: 'red', padding: 20 }} />
    </App>,
  );
});

test('computeStylesNew', () => {
  const component = new PomlComponent('table', undefined, {
    aliases: ['table'],
    unwantedProps: [],
    requiredProps: [],
    applyStyleSheet: true,
    asynchorous: false,
  });
  const stylesheet = {
    '*': {
      padding: 20,
    },
    '.layout': {
      padding: 30,
      margin: 5,
    },
    '.layout2': {
      padding: 40,
    },
    '.layout .layout2': {
      margin: 10,
      color: 'blue',
    },
    'table': {
      color: 'red',
      margin: 20,
    },
    'table .layout': {
      color: 'green',
    },
  };
  expect(component.style({ className: 'layout', padding: 10 }, stylesheet)).toEqual({
    padding: 10,
    margin: 5,
    color: 'green',
  });
  expect(component.style({ className: 'layout layout2', padding: 10 }, stylesheet)).toEqual({
    padding: 10,
    margin: 10,
    color: 'blue',
  });
  expect(component.style({ padding: 10 }, stylesheet)).toEqual({
    padding: 10,
    margin: 20,
    color: 'red',
  });
  expect(component.style({ children: component }, stylesheet)).toEqual({
    children: component,
    padding: 20,
    margin: 20,
    color: 'red',
  });
});

test('calculateSize recursive', () => {
  BufferCollection.clear();
  const obj = { data: { arr: [1, 2, 'abc'] }, extra: Buffer.alloc(4) };
  BufferCollection.set('obj', obj);
  const inst = (BufferCollection as any).instance as any;
  const size = inst.buffers.get('obj').size;
  expect(size).toBe(23);
});
