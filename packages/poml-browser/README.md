# Prompt Scratchpad (POML browser extension)

**This is still under development. The extension is not yet available in the Chrome Web Store.**

## One-liner

A WYSIWYG "prompt workspace" in your browser sidebar where you drag in webpages, docs, code, and media, arrange and annotate them, then one-click copy the rendered prompt into ChatGPT, Gemini, etc. Powered by POML under the hood -- no tags required.

## Who it’s for

- **Heavy LLM users** who assemble long, multi-source prompts (researchers, writers, students).
- **Agent/prompt tinkerers** who want reusable blocks and quick A/B tests across models.
- **Coders** who need to ask about _just the selected files_ without the model drifting.

## Core jobs

- **Collect**: Pull materials (tabs, selections, files) into one place without losing structure.
- **Compose**: Edit instructions + snippets with precise ordering and clear provenance.
- **Preserve**: Keep tables/code formatting intact.
- **Reuse/Share**: Save drafts, version them, share or remix.
- **Dispatch**: Copy the final render into any LLM quickly for A/B testing.

## Why now / Problem

Chat windows are bad editors; docs are decent editors but awkward to paste from; VS Code extensions are for coders and are NOT great for UI-first assembly. Current "prompt galleries" don’t fit one-off, context-heavy tasks. Users want a **chatting scratchpad** that respects structure and sources.

## What it is (at a glance)

A **browser sidebar extension** (Chrome/Edge) that opens a **Prompt Drafting Canvas**. Each canvas holds **blocks** you can reorder:

- **Instruction** (freeform text, with variants)
- **Web capture** (full page, selection, or “clean reader”)
- **Code snippet** (language-aware, keep line numbers; “ask about selected lines only”)
- **Table** (kept as Markdown table or image fallback if needed)
- **Attachment badge** (reference to local file with metadata)
- **Note** (quick bullets, todos)

Under the hood, blocks map to POML elements; users never need to write tags.

### Key benefits

- Drag-and-drop **web pages, Google Docs, Word/PDF, files, code, media** into a single canvas.
- **WYSIWYG editing**: POML is optional/hidden. (Advanced users can peek, most won’t.)
- **One-click copy** to clipboard; paste into ChatGPT/Gemini/Claude for fast A/B tests.
- **Saves, versions, shares** prompt drafts; keep a personal library of reusable blocks.
- **Formatting fidelity** for **tables and code**; cite exact snippets and preserve source links.
- **Block reordering** on one screen; no more scrolling a long chat to tweak an instruction.

### Non-goals / Constraints (current)

- Won’t manipulate ChatGPT’s page or auto-send messages.
- Clipboard: text and **PNG images** only (no arbitrary files).

### Scenarios

- **Research dump**: Drag 5 tabs + a Google Doc excerpt + your notes → reorder → copy to ChatGPT → test versions A/B.
- **Paper writing**: Keep reusable prompt fragments (literature review tone, citation style) + per-paper sources.
- **Code Q\&A**: Select 12 lines in IDE → send selection block → add tight instruction → paste to model with guaranteed scope.
- **Table-heavy asks**: Paste messy spreadsheet → it stays a table (or image fallback) so formatting doesn’t explode.

### Differentiation

- Purpose-built **editor for prompts** (not a chat app, not a code IDE).
- **Structure-aware blocks** with source citations and scoped querying.
- **POML-powered** but **zero-markup authoring**.
- Real-world **fidelity** for tables/code, solves a daily pain users called out.
