from pathlib import Path
from typing import Any, Union

from langchain_core.messages import messages_from_dict
from langchain_core.prompt_values import ChatPromptValue, StringPromptValue
from langchain_core.prompts import PromptTemplate
from typing_extensions import override

from poml.api import poml


def poml_formatter(markup: Union[str, Path], speaker_mode: bool, context: dict | None = None):
    response = poml(markup, chat=speaker_mode, context=context, format="langchain")
    return messages_from_dict(response["messages"])


class LangchainPomlTemplate(PromptTemplate):
    """A LangChain-compatible prompt template that uses POML (Prompt Markup Language) for formatting.

    This class extends LangChain's PromptTemplate to support POML markup, enabling rich prompt
    formatting with speaker modes and structured content. It can load templates from files or
    strings and format them into either ChatPromptValue or StringPromptValue objects.

    Attributes:
        template_file (Union[str, Path, None]): Path to the POML template file, if loaded from file.
        speaker_mode (bool): Whether to format output as chat messages (True) or plain text (False).
            Defaults to True.

    Examples:
        Create from a template string:
        >>> template = LangchainPomlTemplate.from_template(
        ...     "Hello {{name}}!", speaker_mode=True
        ... )
        >>> result = template.format(name="Alice")

        Load from a POML file:
        >>> template = LangchainPomlTemplate.from_file(
        ...     "path/to/template.poml", speaker_mode=False
        ... )
        >>> result = template.format(user_input="What is AI?")

    Note:
        - In speaker_mode=True, returns ChatPromptValue with structured messages
        - In speaker_mode=False, returns StringPromptValue with plain text
        - The from_examples() method is not supported and will raise NotImplementedError
    """

    template_file: Union[str, Path, None] = None
    speaker_mode: bool = True

    @property
    @override
    def lc_attributes(self) -> dict[str, Any]:
        return {
            "template_file": self.template_file,
            "speaker_mode": self.speaker_mode,
            # Template format is not used
            # "template_format": self.template_format,
        }

    @classmethod
    @override
    def get_lc_namespace(cls) -> list[str]:
        return ["poml", "integration", "langchain"]

    @classmethod
    def from_examples(cls, *args, **kwargs):
        raise NotImplementedError(
            "LangchainPomlTemplate does not support from_examples. Use from_template or from_file instead."
        )

    @classmethod
    def from_file(
        cls, template_file: Union[str, Path], *args, speaker_mode: bool = True, **kwargs
    ) -> "LangchainPomlTemplate":
        instance: LangchainPomlTemplate = super().from_file(template_file, **kwargs)  # type: ignore
        instance.template_file = template_file
        instance.speaker_mode = speaker_mode
        return instance

    @classmethod
    def from_template(cls, *args, speaker_mode: bool = True, **kwargs) -> "LangchainPomlTemplate":
        instance: LangchainPomlTemplate = super().from_template(*args, **kwargs)  # type: ignore
        instance.speaker_mode = speaker_mode
        return instance

    def format(self, **kwargs) -> Union[ChatPromptValue, StringPromptValue]:  # type: ignore
        kwargs = self._merge_partial_and_user_variables(**kwargs)
        if self.template_file:
            formatted_messages = poml_formatter(self.template_file, self.speaker_mode, kwargs)
        else:
            formatted_messages = poml_formatter(self.template, self.speaker_mode, kwargs)
        if self.speaker_mode:
            return ChatPromptValue(messages=formatted_messages)
        else:
            if len(formatted_messages) == 1:
                if isinstance(formatted_messages[0].content, str):
                    return StringPromptValue(text=formatted_messages[0].content)
                elif isinstance(formatted_messages[0].content, list):
                    # If the content is a list, we assume it's a single message with multiple parts.
                    if len(formatted_messages[0].content) == 1:
                        # If there's only one part, return it as a StringPromptValue
                        if isinstance(formatted_messages[0].content[0], str):
                            return StringPromptValue(text=formatted_messages[0].content[0])
                        else:
                            raise ValueError(
                                f"Unsupported content type for non-speaker mode: {formatted_messages[0].content[0]}"
                            )
                    else:
                        raise ValueError(
                            f"Multi-part contents is not supported for non-speaker mode: {formatted_messages[0].content}"
                        )
                else:
                    raise ValueError(f"Unsupported content type for non-speaker mode: {formatted_messages[0].content}")
            else:
                raise ValueError(
                    f"Multiple messages returned, but non-speaker mode requires a single message: {formatted_messages}"
                )

    def format_prompt(self, **kwargs):
        return self.format(**kwargs)
