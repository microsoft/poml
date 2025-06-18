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

Install from [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=poml-team.poml).

You can also install the extension manually by downloading the `.vsix` file from our [GitHub releases page](https://github.com/microsoft/poml/releases) and installing it in VS Code via the Extensions view.

Before testing prompts with the POML toolkit, make sure you have configured your preferred LLM model, API key, and endpoint. If these are not set, prompt testing will not work.

**To configure in Visual Studio Code:**
- Open the extension settings (open "Settings" and search for "POML").
- Set your model provider (e.g., OpenAI, Azure, Google), API key, and endpoint URL in the POML section.
- Alternatively, you can add these settings directly to your `settings.json` file.

### Node.js (via npm, coming soon)

```bash
npm install poml
```

### Python (via pip)

```bash
pip install poml
```

For development or local installation, you might use `pip install -e .` from a cloned repository.

## Documentation

For detailed information on POML syntax, components, styling, templating, SDKs, and the VS Code extension, please refer to our [documentation](docs).

## Learn More

* **Watch our Demo Video on YouTube:** [POML Introduction & Demo](https://youtu.be/b9WDcFsKixo)
* **Read the Research Paper (coming soon):** For an in-depth understanding of POML's design, implementation, and evaluation, check out our paper: [Paper link TBD](TBD).

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must follow [Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general). Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party's policies.

## Responsible AI

This project has been evaluated and certified to comply with the Microsoft Responsible AI Standard. The team will continue to monitor and maintain the repository, addressing any severe issues, including potential harms, if they arise. For more details, refer to the [Responsible AI Readme](RAI_README).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
