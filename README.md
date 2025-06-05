# POML: Prompt Orchestration Markup Language

**POML (Prompt Orchestration Markup Language)** is a novel markup language designed to bring structure, maintainability, and versatility to advanced prompt engineering for Large Language Models (LLMs). It addresses common challenges in prompt development, such as lack of structure, complex data integration, format sensitivity, and inadequate tooling. POML provides a systematic way to organize prompt components, integrate diverse data types seamlessly, and manage presentation variations, empowering developers to create more sophisticated and reliable LLM applications.

## Demo Video

[![The 5-minute guide to POML](https://i3.ytimg.com/vi/b9WDcFsKixo/maxresdefault.jpg)](https://youtu.be/b9WDcFsKixo)

## Key Features

* **Structured Prompting Markup**: Employs an HTML-like syntax with semantic components such as `<role>`, `<task>`, and `<example>` to encourage modular design, enhancing prompt readability, reusability, and maintainability.
* **Comprehensive Data Handling**: Incorporates specialized data components (e.g., `<document>`, `<table>`, `<img>`) that seamlessly embed or reference external data sources like text files, spreadsheets, and images, with customizable formatting options.
* **Decoupled Presentation Styling**: Features a CSS-like styling system that separates content from presentation. This allows developers to modify styling (e.g., verbosity, syntax format) via `<stylesheet>` definitions or inline attributes without altering core prompt logic, mitigating LLM format sensitivity.
* **Integrated Templating Engine**: Includes a built-in templating engine with support for variables (`{{ }}`), loops (`for`), conditionals (`if`), and variable definitions (`<let>`) for dynamically generating complex, data-driven prompts.
* **Rich Development Toolkit**:
    * **IDE Extension (Visual Studio Code)**: Provides essential development aids like syntax highlighting, context-aware auto-completion, hover documentation, real-time previews, inline diagnostics for error checking, and integrated interactive testing.
    * **Software Development Kits (SDKs)**: Offers SDKs for Node.js (JavaScript/TypeScript) and Python for seamless integration into various application workflows and popular LLM frameworks.

## Quick Start

Here's a very simple POML example. Please put it in a file named `example.poml`. Make sure it resides in the same directory as the `photosynthesis_diagram.png` image file.

```xml
<poml>
  <role>You are a patient teacher explaining concepts to a 10-year-old.</role>
  <task>Explain the concept of photosynthesis using the provided image as a reference.</task>

  <img src="photosynthesis_diagram.png" alt="Diagram of photosynthesis" />

  <output-format>
    Keep the explanation simple, engaging, and under 100 words.
    Start with "Hey there, future scientist!".
  </output-format>
</poml>
```

This example defines a role and task for the LLM, includes an image for context, and specifies the desired output format. With the POML toolkit, the prompt can be easily rendered with a flexible format, and tested with a vision LLM.

## Installation

### Visual Studio Code Extension

*Coming soon:* Search for "POML" in the Visual Studio Code Marketplace to install the POML extension.

*Currently:* You can install the extension manually by downloading the `.vsix` file from our GitHub releases page and installing it in VS Code via the Extensions view.

You can also install POML using npm for Node.js projects or pip for Python projects.

### Node.js (via npm, coming soon)

```bash
npm install poml
```

### Python (via pip)

*Coming soon:*

```bash
pip install poml
```

*Currently:* For development or local installation, you might use `pip install -e .` from a cloned repository.

## Documentation

For detailed information on POML syntax, components, styling, templating, SDKs, and the VS Code extension, please refer to our [documentation](docs).

## Learn More

* **Watch our Demo Video on YouTube:** [POML Introduction & Demo](https://youtu.be/b9WDcFsKixo)
* **Read the Research Paper (coming soon):** For an in-depth understanding of POML's design, implementation, and evaluation, check out our paper: [Paper link TBD](TBD).

## Contributing

We are excited to build a community around POML! If you're interested in contributing, please check out our [code of conduct](CODE_OF_CONDUCT.md).

## License

POML is released under the [MIT License](LICENSE).
