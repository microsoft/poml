# Dealing with speakers

POML models conversations as a sequence of messages. Each message carries a
`speaker` that indicates who produced it. The `speaker` attribute can appear on
any element and is inherited by its children.

## Available speakers

The following speakers are supported:

- `system`
- `human`
- `ai`
- `tool`

Using a value outside this list results in an error during rendering.

## Automatic speaker assignment

The writer traverses the document tree and assigns speakers to output
segments:

1. The default speaker starts as `system`.
2. When a `human` speaker appears, subsequent unspecified segments default to
   `human`.
3. A `speaker` attribute overrides the inherited value for that element and its
   descendants.
4. Contiguous output with the same speaker is merged into a single segment.
5. If all content is unlabeled, the final speaker becomes `human` unless a
   `system` speaker was explicitly specified.

This logic is implemented in
[`writer.ts`](../../packages/poml/writer.ts)'s `assignSpeakers` function and
ensures consistent speaker attribution throughout the rendered prompt.

## Example

```xml
<poml>
  <p>Unlabeled content defaults to human.</p>
  <p speaker="system">System notice.</p>
  <p>Back to human after the system note.</p>
  <p speaker="ai">Model response.</p>
</poml>
```

Produces the following messages:

```text
[human] Unlabeled content defaults to human.
[system] System notice.
[human] Back to human after the system note.
[ai] Model response.
```
