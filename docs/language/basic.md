# POML Basic Syntax

POML (Prompt Orchestration Markup Language) provides a convenient way to create prompts using a markup language that is easy to read and write. The standalone file mode is the most commonly used approach, where you create a file with a `.poml` extension. This file contains XML-like syntax that POML renders into a prompt. This mode is particularly useful for creating reusable templates and managing complex prompts without embedding POML directly in JSX files or using a Python SDK.

In this mode, you wrap your content with a top-level `<poml>` tag, allowing POML to parse and render your markup correctly. Below is a guide on how to effectively use the standalone file mode.

To create a POML file, simply create a file with the `.poml` extension and wrap your content within the `<poml>` tag:

```xml
<poml>
  <p>Hello, world!</p>
</poml>
```

You can also type anything without a `poml` tag, and it will be treated as a string. It's called "free text mode" in POML. However, it has several limitations currently, including unabling to render any XML tags wrapped with `<>`, unabling to use many special characters, and unabling to use all the wonderful features of POML. So, it's always recommended to use the `poml` tag before everything.

**Tip: Glossary for Beginners:**

- **Tag:** A tag is a fundamental building block in XML (and POML). It's used to mark the beginning and end of an element. Tags are enclosed in angle brackets (`<` and `>`). For example, `<p>` is an opening tag, and `</p>` is a closing tag. Everything between the opening and closing tags is considered part of that element.
- **Attribute:** An attribute provides additional information about an element. Attributes are placed inside the opening tag, and they consist of a name and a value (enclosed in double quotes). For example, in `<p speaker="human">`, `speaker` is the attribute name, and `"human"` is the attribute value.
- **Content:** The content is the text or other elements that appear between the opening and closing tags of an element. For example, in `<p>Hello, world!</p>`, "Hello, world!" is the content of the `<p>` element.

**Escape Characters:** In POML, you can use escape characters to include special characters in your content and attribute values. Due to an implementation issue, the escape syntax in POML is slightly different from what you would know in HTML or XML. For example, to include a double quote (`"`) in your content, you can use `#quot;` (rather than `&quot;`). Here are some common escape characters:

1. `#quot;` for `"`
2. `#apos;` for `'`
3. `#amp;` for `&`
4. `#lt;` for `<`
5. `#gt;` for `>`
6. `#hash;` for `#`
7. `#lbrace;` for `{`
8. `#rbrace;` for `}`

It's not necessary to use the escape characters for most cases, but they can be helpful when you are having trouble displaying those characters in certain cases.
