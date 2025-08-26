import * as React from 'react';

import { describe, expect, test } from '@jest/globals';

import { poml, read, write } from 'poml';
import { Text, List, ListItem } from 'poml/essentials';
import {
  Role,
  Task,
  OutputFormat,
  Hint,
  Example,
  ExampleSet,
  ExampleInput,
  ExampleOutput,
} from 'poml/components/instructions';
import { CaptionedParagraph } from 'poml/components';

describe('instructions', () => {
  test('role', async () => {
    const role = <Role>You are a data scientist.</Role>;
    expect(await poml(role)).toBe('# Role\n\nYou are a data scientist.');

    const roleInJson = <Role syntax='json'>You are a data scientist.</Role>;
    expect(await poml(roleInJson)).toBe('{\n  "role": "You are a data scientist."\n}');
  });

  test('roleTaskFormat', async () => {
    const roleTaskFormat = (
      <Text syntax='json'>
        <Role>You are a data scientist.</Role>
        <Task>Analyze the data.</Task>
        <OutputFormat>JSON</OutputFormat>
      </Text>
    );
    expect(await poml(roleTaskFormat)).toBe(
      '{\n  "role": "You are a data scientist.",\n  "task": "Analyze the data.",\n  "outputFormat": "JSON"\n}',
    );
    const roleTaskFormatMarkdown = (
      <Text syntax='markdown'>
        <Role captionStyle='bold'>You are a data scientist.</Role>
        <Task captionStyle='plain' captionTextTransform='upper'>
          Analyze the data.
        </Task>
        <OutputFormat captionStyle='header' captionEnding='colon'>
          JSON
        </OutputFormat>
      </Text>
    );
    expect(await poml(roleTaskFormatMarkdown)).toBe(
      '**Role:** You are a data scientist.\n\nTASK: Analyze the data.\n\n# Output Format:\n\nJSON',
    );
  });

  test('captionColon', async () => {
    const role = <Role captionEnding='colon'>You are a data scientist.</Role>;
    expect(await poml(role)).toBe('# Role:\n\nYou are a data scientist.');

    const roleWithNewline = (
      <Role captionEnding='colon-newline' captionStyle='bold'>
        You are a data scientist.
      </Role>
    );
    expect(await poml(roleWithNewline)).toBe('**Role:**\nYou are a data scientist.');
  });

  test('task', async () => {
    const task = (
      <Task>
        Planning a schedule for a travel.
        <List>
          <ListItem>Decide on the destination and plan the duration.</ListItem>
          <ListItem>Find useful information about the destination.</ListItem>
          <ListItem>Write down the schedule for each day.</ListItem>
        </List>
      </Task>
    );
    expect(await poml(task)).toBe(
      '# Task\n\nPlanning a schedule for a travel.\n\n- Decide on the destination and plan the duration.\n- Find useful information about the destination.\n- Write down the schedule for each day.',
    );
  });

  test('captioned paragraph', async () => {
    const task = (
      <CaptionedParagraph caption='Task' syntax='yaml'>
        <List>
          <ListItem>Decide on the destination and plan the duration.</ListItem>
          <ListItem>Find useful information about the destination.</ListItem>
        </List>
      </CaptionedParagraph>
    );
    expect(await poml(task)).toBe(
      'Task:\n  - Decide on the destination and plan the duration.\n  - Find useful information about the destination.',
    );
  });

  test('hint', async () => {
    const hint = <Hint>Use the following code to analyze the data.</Hint>;
    expect(await poml(hint)).toBe('**Hint:** Use the following code to analyze the data.');
  });

  test('examples', async () => {
    const examples = (
      <ExampleSet introducer='Here are some examples.'>
        <Example>
          <ExampleInput captionStyle='bold'>What's the capital of France?</ExampleInput>
          <ExampleOutput captionStyle='bold'>Paris</ExampleOutput>
        </Example>
        <Example>
          <ExampleInput captionStyle='bold'>What's the capital of Germany?</ExampleInput>
          <ExampleOutput captionStyle='bold'>Berlin</ExampleOutput>
        </Example>
      </ExampleSet>
    );
    expect(await poml(examples)).toBe(
      "# Examples\n\nHere are some examples.\n\n**Input:** What's the capital of France?\n\n**Output:** Paris\n\n**Input:** What's the capital of Germany?\n\n**Output:** Berlin",
    );
    expect(JSON.parse((await poml(<Text syntax='json'>{examples}</Text>)) as string)).toStrictEqual({
      examples: [
        {
          input: "What's the capital of France?",
          output: 'Paris',
        },
        {
          input: "What's the capital of Germany?",
          output: 'Berlin',
        },
      ],
    });

    const ir = await read(examples);
    const out = write(ir, { speaker: true });
    expect(out).toStrictEqual([
      {
        speaker: 'system',
        content: '# Examples\n\nHere are some examples.',
      },
      {
        speaker: 'human',
        content: "**Input:** What's the capital of France?",
      },
      { speaker: 'ai', content: '**Output:** Paris' },
      {
        speaker: 'human',
        content: "**Input:** What's the capital of Germany?",
      },
      { speaker: 'ai', content: '**Output:** Berlin' },
    ]);
  });

  test('examples for loop', async () => {
    const text = `<poml><let name="examples" value='{{[{"input":"What is the capital of France","output":"Paris"},{"input":"What is the capital of Germany","output":"Berlin"}]}}'/>
<examples>
<example for="example in examples" chat="false" caption="Example {{ loop.index+1 }}" captionStyle="header">
<input captionEnding="none">{{ example.input }}</input>
<output captionEnding="newline" captionStyle="plain">{{ example.output }}</output>
</example>
</examples></poml>`;
    const result = await poml(text);
    expect(result).toBe(`# Examples

## Example 1

**Input** What is the capital of France

Output
Paris

## Example 2

**Input** What is the capital of Germany

Output
Berlin`);
  });

  test('examples with intro', async () => {
    const text = `<poml><example captionStyle="plain"><input>abc</input><output>def</output></example></poml>`;
    const ir = await read(text);
    const result = write(ir, { speaker: true });
    expect(result).toStrictEqual([
      { speaker: 'system', content: 'Example:' },
      { speaker: 'human', content: 'abc' },
      { speaker: 'ai', content: 'def' },
    ]);
  });
});
