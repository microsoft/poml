## Controlling Characters and Tokens

!!! warning

    This feature is experimental and may change in future releases. Use with caution.

POML provides experimental features for controlling content length through character limits, token limits, and priority-based truncation. These features are particularly useful when working with AI models that have input constraints or when you need to ensure content fits within specific bounds.

### Character and Token Limits

You can set soft limits on content using `charLimit` and `tokenLimit` attributes. When content exceeds these limits, it will be automatically truncated with a marker.

```xml
<poml>
  <!-- Limit content to 100 characters -->
  <p charLimit="100">This is a very long paragraph that will be truncated if it exceeds the character limit. The truncation will add a marker to indicate that content was cut off.</p>
  
  <!-- Limit content to 50 tokens -->
  <p tokenLimit="50">This paragraph will be truncated based on token count rather than character count, which is more accurate for AI model processing.</p>
</poml>
```

### Priority-Based Truncation

The `priority` attribute allows you to control which content is preserved when space is limited. Lower priority content (lower numbers) will be truncated first.

```xml
<poml tokenLimit="100">
  <p priority="1">This content has low priority and may be removed first to save space.</p>
  
  <p priority="3">This content has high priority and will be preserved longer.</p>
  
  <p priority="2">This content has medium priority.</p>
  
  <!-- Content without priority defaults to priority 0 (lowest) -->
  <p>This content will be truncated first since it has no explicit priority.</p>
</poml>
```

### Combining Limits and Priority

You can combine different types of limits with priority settings for sophisticated content management:

```xml
<poml tokenLimit="200">
  <h priority="5">Critical Section Header</h>
  
  <p priority="4" charLimit="150">
    Important introduction that should be preserved but can be shortened individually.
  </p>
  
  <list priority="2">
    <item priority="3">High priority item</item>
    <item priority="1">Lower priority item</item>
    <item>Lowest priority item (no explicit priority)</item>
  </list>
  
  <p priority="1" tokenLimit="30">
    Optional additional context that can be truncated aggressively.
  </p>
</poml>
```

### Understanding Truncation Behavior

- **Character limits** count actual characters (including spaces and punctuation)
- **Token limits** use AI tokenization, which is more accurate for model processing
- **Priority-based truncation** removes entire elements, starting with the lowest priority
- **Individual limits** apply to single elements, while document limits affect the entire content
- **Truncation markers** (typically "(...truncated)") are automatically added to indicate cut content
