# TypeScript API Reference

<!-- prettier-ignore -->
!!! warning

    The TypeScript API is currently in rapid development and may change frequently. Please do not consider it a stable API. Use at your own risk.

<!-- prettier-ignore -->
!!! note

    This documentation is auto-generated from the TypeScript source code using TypeDoc.

## Installation

### Stable Release

To use the POML TypeScript API, install the package via npm:

```bash
npm install pomljs
```

### Nightly Build

```bash
npm install pomljs@nightly
```

## Quick Start

```tsx
import { Paragraph, Image } from 'poml/essentials';
import { read, write } from 'poml';
const prompt = (
  <Paragraph>
    Hello, world! Here is an image:
    <Image src='photo.jpg' alt='A beautiful scenery' />
  </Paragraph>
);

// Parse the prompt components into an intermediate representation (IR)
const ir = await read(prompt);

// Render it to different formats
const markdown = write(ir);
```

## Links

- [Components Documentation](../language/components.md): detailed component specifications with examples and parameters.
- [TypeScript API Reference](./reference/index.md): auto-generated API reference for TypeScript components and utilities.
