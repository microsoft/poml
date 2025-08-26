# LangChain Integration

POML provides seamless integration with LangChain through the `LangchainPomlTemplate` class, offering a powerful alternative to LangChain's built-in templating systems (Jinja2 and f-strings).

## Installation

```bash
pip install langchain langchain-openai
```

## Basic Usage

POML templates can be used directly in LangChain chains:

```python
from poml.integration.langchain import LangchainPomlTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser

# Load POML template from file
prompt_template = LangchainPomlTemplate.from_file("explain_code.poml")

# Or create from string
prompt_template = LangchainPomlTemplate.from_template(
    "<poml><task>Explain this:</task>"
    "<code inline=\"false\"><document src=\"{{ code_file }}\" parser=\"txt\" /></code></poml>"
)

# Use in a LangChain chain
llm = ChatOpenAI(model="gpt-4.1")
chain = prompt_template | llm | StrOutputParser()

result = chain.invoke({"code_file": "test_sample.py"})
```

## Speaker Mode vs Non-Speaker Mode

POML templates support two modes for different use cases:

```python
# Speaker mode: Returns ChatPromptValue with structured messages
# Use when you need conversation structure (system, user, assistant messages)
template = LangchainPomlTemplate.from_file("conversation.poml", speaker_mode=True)

# Non-speaker mode: Returns StringPromptValue with plain text
# Use when you need a single text output
template = LangchainPomlTemplate.from_file("summary.poml", speaker_mode=False)
```

## POML vs f-string, Jinja, and Other Templates

You can harvest most features of POML by using `LangchainPomlTemplate`. However, some POML features are also available in other templating systems, and some features might not be compatible with LangChain (e.g., tool use). We thus summarize the key differences and advantages of using POML templates over alternative templating methods, to give you a clearer picture of when and why to choose POML.

### Template Syntax and Capabilities

**Jinja2/f-string templates:** Limited to string interpolation and basic conditionals/loops (with Jinja).

```python
prompt_template = PromptTemplate.from_template(
    "Answer the question as if you are {person}, fully embodying their style, "
    "wit, personality, and habits of speech. The question is: {question}"
)
```

**POML templates:** Supports string interpolation plus structured components and logic flows.

```xml
<poml>
  <system-msg>You are {{ person }}, answer in their unique style and personality.</system-msg>
  <human-msg>{{ question }}</human-msg>
  <div if="include_examples">
    <examples>
      <document src="{{ person }}_examples.txt" />
    </examples>
  </div>
</poml>
```

Invoke it with:

```python
prompt_template = LangchainPomlTemplate.from_file("persona_prompt.poml")
prompt_template.invoke({
    "person": "Mark Twain",
    "question": "What is the meaning of life?",
    "include_examples": True
})
```

### Rich Content and File Inclusion

**Alternative approach with Jinja2/f-string:** Must manually read and process PDF with external libraries and include text in the template.

```python
import PyPDF2
from langchain.prompts import PromptTemplate

def read_pdf(file_path):
    with open(file_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
    return text

pdf_content = read_pdf("document.pdf")
prompt = PromptTemplate.from_template(
    "Analyze this document:\n{pdf_text}\n\nQuestion: {question}"
)
result = chain.invoke({"pdf_text": pdf_content, "question": "What are the key points?"})
```

**POML approach:** Automatic PDF processing with no manual file processing needed.

```xml
<poml>
  <task>Analyze this document and answer the question.</task>
  <document src="{{ pdf_path }}" />
  <human-msg>{{ question }}</human-msg>
</poml>
```

```python
result = chain.invoke({"pdf_path": "document.pdf", "question": "What are the key points?"})
```

### Structured Tags to Organize Few-shot Examples

**LangChain's FewShotPromptTemplate:**

```python
from langchain.prompts import FewShotPromptTemplate, PromptTemplate

examples = [
    {"input": "2+2", "output": "4"},
    {"input": "3*3", "output": "9"}
]

example_prompt = PromptTemplate(
    input_variables=["input", "output"],
    template="Input: {input}\nOutput: {output}"
)

few_shot_prompt = FewShotPromptTemplate(
    examples=examples,
    example_prompt=example_prompt,
    prefix="Solve these math problems:",
    suffix="Input: {input}\nOutput:",
    input_variables=["input"]
)
```

**POML approach with structured examples:**

```xml
<poml>
  <task>Solve these math problems:</task>

  <example for="ex in examples">
    <example-input>{{ ex.input }}</example-input>
    <example-output>{{ ex.output }}</example-output>
  </example>

  <human-msg>{{ input }}</human-msg>
</poml>
```

Immediately gives you:

```json
[
  { "speaker": "system", "content": "# Task\n\nSolve these math problems:" },
  { "speaker": "human", "content": "2+2" },
  { "speaker": "ai", "content": "4" },
  { "speaker": "human", "content": "3*3" },
  { "speaker": "ai", "content": "9" },
  { "speaker": "human", "content": "5-4" }
]
```

### Support for Conversational Formats

**Alternative approach:** Multiple separate prompts or complex string concatenation.

```python
system_prompt = "You are a helpful assistant."
user_prompt = "What is {{ language }}?"
assistant_response = "{{ language }} is a programming language..."
followup = "Can you give an example of {{ language }}?"

# Manually manage conversation flow
template_user = PromptTemplate.from_template(user_prompt)
template_assistant = PromptTemplate.from_template(assistant_response)
template_followup = PromptTemplate.from_template(followup)

template_messages = [
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": template_user},
    {"role": "ai", "content": template_assistant},
    {"role": "user", "content": template_followup},
]
```

**POML approach:** One file for an entire AI conversation.

```xml
<poml>
  <system-msg>You are a helpful assistant.</system-msg>
  <human-msg>What is {{ language }}?</human-msg>
  <ai-msg>{{ language }} is a high-level, interpreted programming language...</ai-msg>
  <human-msg>Can you give an example of {{ language }}?</human-msg>
</poml>
```

## Future Integrations

Support for additional observability platforms is planned:

- **LangSmith**: Integration for LangChain's debugging and monitoring platform
- **Langfuse**: LLM observability and analytics
