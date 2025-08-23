# Token Control

## Controlling Characters and Tokens

!!! warning

    This feature is experimental and may change in future releases. Use with caution.

POML controls content length through character limits, token limits, and priority-based truncation. These features are particularly useful when working with AI models that have input constraints or when you need to ensure content fits within specific bounds.

!!! note

    Token control is only supported on components rendered with `syntax="text"` or `syntax="markdown"`.

### Character and Token Limits

You can set soft limits on content using `charLimit` and `tokenLimit` attributes. When content exceeds these limits, it will be automatically truncated with a marker.

```xml
<poml>
  <!-- Limit content to 100 characters -->
  <p charLimit="100">This is a very long paragraph that will be truncated if it exceeds the character limit. The truncation will add a marker to indicate that content was cut off.</p>
  
  <!-- Limit content to 50 tokens -->
  <p tokenLimit="10">This paragraph will be truncated based on token count rather than character count, which is more accurate for AI model processing.</p>
</poml>
```

Renders to:

```text
This is a very long paragraph that will be truncated if it exceeds the character limit. The truncati (...truncated)

This paragraph will be truncated based on token count rather (...truncated)
```

// Add explanation for writerOptions here, which is another experimental feature.

```xml
<p charLimit="20" writerOptions='{ "truncateMarker": " [...] ", "truncateDirection": "middle"}'>This is a very long paragraph that will be truncated if it exceeds the character limit. The truncation will add a marker to indicate that content was cut off.</p>
```

 The default tokenizer to count tokens is based on `js-tiktoken` with `o200k_base` (used in `gpt-4o` and `o3` models). You can customize it by specifying the model name (not tokenizer name) in `tokenEncodingModel` in `writerOptions`.

### Priority-Based Truncation

The `priority` attribute allows you to control which content is preserved when space is limited. Lower priority content (lower numbers) will be truncated first.

```xml
<poml tokenLimit="40">
  <p priority="1">This content has low priority and may be removed first to save space.</p>
  
  <p priority="3">This content has high priority and will be preserved longer.</p>
  
  <p priority="2">This content has medium priority.</p>
  
  <!-- Content without priority defaults to priority 0 (lowest) -->
  <p>This content will be truncated first since it has no explicit priority.</p>
</poml>
```

Renders to:

```text
This content has low priority and may be removed first to save space.

This content has high priority and will be preserved longer.

This content has medium priority.
```

If the token limit is reduced further to 8, highest priority content is preserved, and also truncated with a marker:

```text
This content has high priority and will be (...truncated)
```

### Combining Limits and Priority

You can combine different types of limits with priority settings for sophisticated content management. Please note that the tokens are calculated from the bottom up. so the whole list will not be kepted in the following example .// please explain this better.

```xml
<poml tokenLimit="40">
  <h priority="5">Critical Section Header</h>
  
  <p priority="4" charLimit="10">
    Important introduction that should be preserved but can be shortened individually.
  </p>
  
  <list priority="2">
    <item priority="3">High priority item</item>
    <item priority="1">Lower priority item</item>
    <item>Lowest priority item (no explicit priority)</item>
  </list>

  <p priority="3" tokenLimit="5">Optional additional context that can be truncated aggressively.</p>
</poml>
```

Renders to:

```text
# Critical Section Header

Important  (...truncated)

Optional additional context that can (...truncated)
```
