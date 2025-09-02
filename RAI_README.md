# POML: Prompt Orchestration Markup Language

Version 0.1. Updated on 2025-03-27. Please see [README](README.md) for latest info.

## Overview

POML (Prompt Orchestration Markup Language) is a markup language designed for crafting prompts for Large Language Models (LLMs). It provides a structured, reusable, and maintainable way to interact with AI, similar to how HTML is used for building web pages. POML allows you to build clear, modular prompts using components, making prompt creation easier and more efficient.

## What Can POML Do

POML was developed to streamline the process of creating and managing prompts for LLMs. It solves the problem of messy, hard-to-manage prompts by introducing a structured, component-based approach. This makes prompts easier to read, understand, modify, and reuse. POML also offers a modern developer experience with features like syntax highlighting, auto-completion, and live preview in VSCode.

## Intended Uses

POML is best suited for researchers, developers, and anyone who frequently interacts with LLMs and needs a more efficient way to manage their prompts.

POML is being shared with the research community to facilitate the development of advanced prompting techniques and foster further research in this area.

POML is intended to be used by domain experts who are independently capable of evaluating the quality of prompts before acting on them.

## Out-of-Scope Uses

POML is not well suited for directly crafting production-ready prompts without further testing.

We do not recommend using POML in commercial or real-world applications without further testing and development. It is being released for research purposes.

POML was not designed or evaluated for all possible downstream purposes. Developers should consider its inherent limitations as they select use cases, and evaluate and mitigate for accuracy, safety, and fairness concerns specific to each intended downstream use.

POML should not be used in highly regulated domains where inaccurate outputs could suggest actions that lead to injury or negatively impact an individual's legal, financial, or life opportunities.

We do not recommend using POML in the context of high-risk decision making (e.g. in law enforcement, legal, finance, or healthcare).

## How to Get Started

To begin using POML:

- Install the VS Code Extension: Search for "POML" in the VS Code Extensions marketplace and install it. This gives you all the awesome editor features!
- Create a .poml file: Start writing your prompts using POML's intuitive syntax.
- Explore the Documentation: Dive deeper into all the available components and features. You can find the documentation in the extension or on the GitHub page.

## Evaluation

POML has undergone rigorous evaluation through both controlled experiments and real-world application testing. The system demonstrates effectiveness in structuring prompts, handling diverse data formats, and providing consistent styling across different LLMs. User studies confirm its utility in practical scenarios while identifying areas for improvement. The evaluation validates POML's core design goals:

- Creating reusable and maintainable prompt markup
- Providing comprehensive data handling capabilities
- Decoupling content from presentation
- Enhancing tooling for development and collaboration

### Evaluation Methods

1.  **Case Studies**
    - TableQA: Systematic testing of 27,223 unique style configurations across 7 different LLMs using WikiTableQuestions dataset
    - PomLink: RAG application development integrating POML for document, image, table, and web content processing (another project, not included in this release)
2.  **User Study**
    - A within-group user study featuring 10 participants completing 5 different tasks
    - Tasks included prompt rewriting, document processing, data analysis, programming, and subtitle translation
    - Qualitative feedback collection through think-aloud protocols
    - Performance metrics tracking (task completion times, success rates)
3.  **Technical Testing**
    - 10 test suites with 115 test cases
    - Coverage from basic tag parsing to complex multi-modal data integration
    - Testing of error handling and recovery mechanisms

### Evaluation Results

1.  **TableQA Case Study**
    - Confirmed that simple stylesheet adjustments could dramatically improve performance without changing core content
    - Confirmed that POML is robust under all the prompt contents and stylings involved in the study.
2.  **PomLink Case Study**
    - Successfully integrated POML into a large application
    - Demonstrated effective handling of diverse data formats (documents, images, tables, webpages)
    - Showed benefits of centralized stylesheet management and component reuse
3.  **User Study Results**
    - Task completion rates varied by complexity (simpler tasks like document processing had higher success rates)
    - Users found POML particularly valuable for handling multiple file formats and structured prompts
    - Challenges identified included learning curve, file format issues, and desire for multi-turn interactions
    - Users appreciated the clear structure and data integration capabilities
    - Users have identified a series of bugs within POML. They have been resolved quickly in the last development cycle.

## Limitations

POML was developed for research and experimental purposes. Further testing and validation are needed before considering its application in commercial or real-world scenarios.

POML was designed and tested using the English language. Performance in other languages may vary and should be assessed by someone who is both an expert in the expected outputs and a native speaker of that language.

POML was designed to optimize the user’s prompt and does nothing to alter the underlying structure/function of the user’s chosen LLM. Users are reminded that all outputs generated by AI may include factual errors, fabrication, or bias. Users are responsible for assessing the accuracy of generated content. All decisions leveraging outputs of the system should be made with human oversight and not be based solely on system outputs.

## Best Practices

Better performance can be achieved by utilizing POML's features such as reusable components, stylesheets, and the template engine to create clear, concise, and adaptable prompts.

We strongly encourage users to use LLMs/MLLMs that support robust Responsible AI mitigations, such as Azure Open AI (AOAI) services. Such services continually update their safety and RAI mitigations with the latest industry standards for responsible use. For more on AOAI’s best practices when employing foundations models for scripts and applications:

- [Blog post on responsible AI features in AOAI that were presented at Ignite 2023](https://techcommunity.microsoft.com/t5/ai-azure-ai-services-blog/announcing-new-ai-safety-amp-responsible-ai-features-in-azure/ba-p/3983686)
- [Overview of Responsible AI practices for Azure OpenAI models](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/overview)
- [Azure OpenAI Transparency Note](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/transparency-note)
- [OpenAI’s Usage policies](https://openai.com/policies/usage-policies)
- [Azure OpenAI’s Code of Conduct](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/code-of-conduct)

## Contact

We welcome feedback and collaboration from our audience. If you have suggestions, questions, or observe unexpected/offensive behavior in our technology, please contact us at Yuge.Zhang@microsoft.com.

If the team receives reports of undesired behavior or identifies issues independently, we will update this repository with appropriate mitigations.
