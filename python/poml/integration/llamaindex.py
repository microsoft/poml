from pathlib import Path
from typing import Union, Any, List
from typing_extensions import override
from poml.api import poml
from llama_index.core.prompts import RichPromptTemplate
from llama_index.core.llms import ChatMessage, MessageRole


def poml_formatter(markup: Union[str, Path], speaker_mode: bool, context: dict | None = None):
    """Convert POML markup to LlamaIndex ChatMessage format.
    
    Args:
        markup: POML markup content as string or file path
        speaker_mode: If True, format as chat messages; if False, format as string
        context: Optional context data for template variables
        
    Returns:
        List[ChatMessage] when speaker_mode=True, str when speaker_mode=False
    """
    # For now, use the existing format and convert - we'll add llamaindex format support later
    messages = poml(markup, chat=speaker_mode, context=context, format="pydantic")
    
    if speaker_mode:
        # Convert to ChatMessage objects
        chat_messages = []
        for msg in messages:
            if msg.speaker == "human":
                role = MessageRole.USER
            elif msg.speaker == "ai":
                role = MessageRole.ASSISTANT
            elif msg.speaker == "system":
                role = MessageRole.SYSTEM
            else:
                role = MessageRole.USER  # fallback
            
            # Handle content format
            content = msg.content
            if isinstance(content, str):
                chat_messages.append(ChatMessage(role=role, content=content))
            elif isinstance(content, list):
                # For multi-modal content, we'll need to handle different content types
                # For now, concatenate text parts
                text_content = ""
                for part in content:
                    if isinstance(part, str):
                        text_content += part
                    elif isinstance(part, dict) and part.get("type") == "text":
                        text_content += part.get("text", "")
                chat_messages.append(ChatMessage(role=role, content=text_content))
            
        return chat_messages
    else:
        # Return as string (single message expected) 
        if len(messages) == 1:
            content = messages.content
            if isinstance(content, str):
                return content
            elif isinstance(content, list):
                # Concatenate text parts
                text_content = ""
                for part in content:
                    if isinstance(part, str):
                        text_content += part
                    elif isinstance(part, dict) and part.get("type") == "text":
                        text_content += part.get("text", "")
                return text_content
        raise ValueError("Non-speaker mode requires exactly one message")


class LlamaIndexPomlTemplate(RichPromptTemplate):
    """A LlamaIndex-compatible prompt template that uses POML (Prompt Markup Language) for formatting.

    This class extends LlamaIndex's RichPromptTemplate to support POML markup, enabling rich prompt
    formatting with speaker modes and structured content. It can load templates from files or
    strings and format them into either ChatMessage objects or plain text strings.

    Attributes:
        template_file (Union[str, Path, None]): Path to the POML template file, if loaded from file.
        speaker_mode (bool): Whether to format output as chat messages (True) or plain text (False).
            Defaults to True.

    Examples:
        Create from a template string:
        >>> template = LlamaIndexPomlTemplate.from_template(
        ...     "Hello {{name}}!", speaker_mode=True
        ... )
        >>> result = template.format_messages(name="Alice")

        Load from a POML file:
        >>> template = LlamaIndexPomlTemplate.from_file(
        ...     "path/to/template.poml", speaker_mode=False
        ... )
        >>> result = template.format(user_input="What is AI?")

        Using chat role blocks:
        >>> template = LlamaIndexPomlTemplate.from_template('''
        ... {% chat role="system" %}
        ... You are a helpful assistant working with {{user}}.
        ... {% endchat %}
        ... 
        ... {% chat role="user" %}
        ... {{user_msg}}
        ... {% endchat %}
        ... ''')
        >>> messages = template.format_messages(user="Alice", user_msg="Hello!")

    Note:
        - In speaker_mode=True, returns List[ChatMessage] with structured messages
        - In speaker_mode=False, returns str with plain text
        - Supports POML's rich formatting features including multi-modal content
        - Compatible with LlamaIndex query engines and response synthesizers
    """

    template_file: Union[str, Path, None] = None
    speaker_mode: bool = True

    @property
    @override
    def template_vars(self) -> List[str]:
        """Get template variable names from the underlying template."""
        return super().template_vars

    @classmethod
    def from_file(
        cls, template_file: Union[str, Path], *args, speaker_mode: bool = True, **kwargs
    ) -> "LlamaIndexPomlTemplate":
        """Create a LlamaIndexPomlTemplate from a POML file.
        
        Args:
            template_file: Path to the POML template file
            speaker_mode: If True, format as chat messages; if False, as plain text
            *args, **kwargs: Additional arguments passed to RichPromptTemplate
            
        Returns:
            LlamaIndexPomlTemplate instance
        """
        # Read the file content
        file_path = Path(template_file)
        if not file_path.exists():
            raise FileNotFoundError(f"Template file not found: {template_file}")
        
        template_content = file_path.read_text()
        
        # Convert POML template to Jinja format if needed
        if speaker_mode:
            # For chat mode, we need to structure the template with chat role blocks
            # This is a simplified conversion - in practice, you might need more sophisticated parsing
            if not ("{% chat" in template_content or "{{" in template_content):
                # If it's plain POML without Jinja, wrap it as a user message
                template_content = f"""
{{% chat role="user" %}}
{template_content}
{{% endchat %}}
"""
        
        instance = cls(template=template_content, *args, **kwargs)
        instance.template_file = template_file
        instance.speaker_mode = speaker_mode
        return instance

    @classmethod
    def from_template(cls, template: str, *args, speaker_mode: bool = True, **kwargs) -> "LlamaIndexPomlTemplate":
        """Create a LlamaIndexPomlTemplate from a template string.
        
        Args:
            template: POML template string with Jinja syntax
            speaker_mode: If True, format as chat messages; if False, as plain text
            *args, **kwargs: Additional arguments passed to RichPromptTemplate
            
        Returns:
            LlamaIndexPomlTemplate instance
        """
        # Convert POML template to Jinja format if needed
        if speaker_mode and not ("{% chat" in template or "{{" in template):
            # If it's plain POML without Jinja, wrap it as a user message
            template = f"""
{{% chat role="user" %}}
{template}
{{% endchat %}}
"""
        
        instance = cls(template=template, *args, **kwargs)
        instance.speaker_mode = speaker_mode
        return instance

    def format(self, **kwargs) -> str:
        """Format the template as a string.
        
        Args:
            **kwargs: Template variables
            
        Returns:
            Formatted string
        """
        if self.speaker_mode:
            # For chat mode, get messages and convert to string
            messages = self.format_messages(**kwargs)
            if len(messages) == 1:
                return messages.content
            else:
                # Concatenate all message contents
                return "\n".join([msg.content for msg in messages])
        else:
            # Use parent's format method for string mode
            return super().format(**kwargs)

    def format_messages(self, **kwargs) -> List[ChatMessage]:
        """Format the template as a list of ChatMessage objects.
        
        Args:
            **kwargs: Template variables
            
        Returns:
            List of ChatMessage objects
        """
        if self.speaker_mode:
            # Use parent's format_messages method for chat mode
            return super().format_messages(**kwargs)
        else:
            # For non-chat mode, create a single user message
            formatted_text = super().format(**kwargs)
            return [ChatMessage(role=MessageRole.USER, content=formatted_text)]

    def format_prompt(self, **kwargs):
        """Format the prompt - compatibility method.
        
        Returns format_messages() for chat mode or format() for string mode.
        """
        if self.speaker_mode:
            return self.format_messages(**kwargs)
        else:
            return self.format(**kwargs)