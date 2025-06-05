import xml.etree.ElementTree as ET
import base64
import json
import tempfile
import warnings

from .api import poml
from ._tags import _TagLib


def _write_file_for_poml(content: str):
    """Writes content to a named temporary file that is not deleted on close."""
    # The caller is responsible for managing the lifecycle of this file, including deletion.
    temp_file = tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", delete=False)
    temp_file.write(content)
    temp_file.flush()  # Ensure content is written to disk
    # temp_file.close() # Consider if the file should be closed here or by the caller.
    return temp_file


class _ImplicitDualTagHandler:
    """
    Handles XML tags that can be self-closing or act as context managers for nested content.
    It creates an ET.Element on initialization and adds it to the current parent.
    If used with 'with', it pushes the element onto the Prompt's parent stack.
    """

    def __init__(self, prompt_instance: "Prompt", tag_name: str, attrs: dict):
        self.prompt = prompt_instance
        self.tag_name = tag_name

        prepared_attrs = self.prompt._prepare_attrs(**attrs)
        self.element = ET.Element(tag_name, prepared_attrs)

        if self.prompt.current_parent_stack:
            # Append as child to the currently open element
            self.prompt.current_parent_stack[-1].append(self.element)
        else:
            # No parent on stack, so this is a root-level element
            self.prompt.root_elements.append(self.element)

        self._is_context_managed = False  # True if __enter__ completes successfully

    def __enter__(self):
        # This element now becomes the current parent for any nested tags or text.
        self.prompt.current_parent_stack.append(self.element)
        self._is_context_managed = True
        return self.prompt  # Return Prompt instance for chained calls like p.text()

    def __exit__(self, exc_type, exc_val, exc_tb):
        if not self._is_context_managed:
            # This means __enter__ did not complete successfully, or the handler
            # was instantiated but not used correctly in a 'with' statement.
            raise SystemError(
                f"Exiting tag handler for '{self.element.tag}' that was not properly context-managed. "
                "Ensure it's used in a 'with' statement and __enter__ completed."
            )

        # If __enter__ completed, self.element was pushed onto the stack.
        if not self.prompt.current_parent_stack:
            # This indicates a critical internal logic error.
            raise SystemError(
                f"Internal error: Tag stack empty while exiting context for '{self.element.tag}'. "
                "_is_context_managed was True, implying a tag should be on stack."
            )

        popped_element = self.prompt.current_parent_stack.pop()
        if popped_element is not self.element:
            # This is a critical internal error, indicating mismatched tags or stack corruption.
            self.prompt.current_parent_stack.append(popped_element)  # Restore the stack to its previous state
            raise SystemError(
                f"XML structure error: Mismatched tag on context exit. Expected to pop '{self.element.tag}', "
                f"but found '{popped_element.tag}'. This suggests an issue with nested contexts."
            )


class Prompt(_TagLib):
    """
    Builds an XML structure using ElementTree, supporting context-managed tags.
    """

    def __init__(self):
        self.root_elements: list[ET.Element] = []
        self.current_parent_stack: list[ET.Element] = []  # Stack of current ET.Element parents

    def _prepare_attrs(self, **attrs) -> dict[str, str]:
        """Converts attribute values to strings suitable for ElementTree."""
        prepared = {}
        for k, v in attrs.items():
            if v is None:  # Skip None attributes
                continue
            key_str = str(k)  # Keys are typically strings
            if isinstance(v, bool):
                val_str = str(v).lower()  # XML often uses "true"/"false"
            elif isinstance(v, bytes):
                b64 = base64.b64encode(v).decode()
                if key_str == "buffer":
                    prepared["base64"] = b64
                    continue
                else:
                    val_str = base64.b64encode(v).decode("ascii")
            elif isinstance(v, (int, float, str)):
                val_str = str(v)
            else:
                val_str = json.dumps(v)  # Fallback for complex types, convert to JSON string
            prepared[key_str] = val_str
        return prepared

    def text(self, content: str):
        """Adds text content to the currently open XML element."""
        if not self.current_parent_stack:
            raise ValueError("Cannot add text: No tag is currently open. Use a 'with' block for a tag.")

        current_el = self.current_parent_stack[-1]
        # ElementTree handles XML escaping for text content automatically
        content_str = str(content)

        # Append text correctly for mixed content (text between child elements)
        if len(current_el) > 0:  # If current element has children
            last_child = current_el[-1]
            if last_child.tail is None:
                last_child.tail = content_str
            else:
                last_child.tail += content_str
        else:  # No children yet in the current element, add to its primary text
            if current_el.text is None:
                current_el.text = content_str
            else:
                current_el.text += content_str

    def _generate_xml_string(self, pretty: bool) -> str:
        """
        Serializes the built XML structure to a string.
        Can optionally pretty-print the output.
        """
        if self.current_parent_stack:
            # This warning is for cases where rendering/dumping happens with unclosed tags.
            print(
                f"Warning: Generating XML with open tags: {[el.tag for el in self.current_parent_stack]}. "
                "Ensure all 'with' blocks for tags are properly exited before finalizing XML."
            )

        xml_strings = []
        for root_el in self.root_elements:
            if pretty:
                # ET.indent modifies the element in-place (Python 3.9+)
                ET.indent(root_el, space="  ", level=0)
                xml_strings.append(ET.tostring(root_el, encoding="unicode", method="xml"))
            else:
                # Serialize compactly without extra whitespace
                xml_strings.append(ET.tostring(root_el, encoding="unicode", method="xml"))

        # Join the string representations of each root-level element.
        # If pretty printing and multiple roots, join with newlines for readability.
        # Otherwise, join directly to form a contiguous XML stream.
        joiner = "\n" if pretty and len(xml_strings) > 0 else ""  # Add newline between pretty roots
        return joiner.join(xml_strings)

    def render(self, chat: bool = True, context=None, stylesheet=None) -> list | dict | str:
        """
        Renders the final XML. Raises error if tags are still open.
        """
        if self.current_parent_stack:
            raise ValueError(
                f"Cannot render: Open tags remaining: {[el.tag for el in self.current_parent_stack]}. "
                "Ensure all 'with' blocks for tags are properly exited."
            )
        # poml likely expects a compact, single XML string.
        final_xml = self._generate_xml_string(pretty=False)
        return poml(final_xml, context=context, stylesheet=stylesheet, chat=chat)

    def dump_xml(self) -> str:
        """
        Dumps the generated XML string, pretty-printed by default (useful for debugging).
        """
        return self._generate_xml_string(pretty=True)

    def __enter__(self):
        """Initializes Prompt for a new XML construction session within a 'with' block."""
        self.root_elements = []
        self.current_parent_stack = []
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Cleans up Prompt state upon exiting a 'with' block."""
        if self.current_parent_stack and exc_type is None:
            # This means the Prompt context itself exited while some _ImplicitDualTagHandler
            # contexts (tags) were still notionally open.
            warnings.warn(
                f"Warning: Prompt context exited with open tags: {[el.tag for el in self.current_parent_stack]}. "
                "This may indicate nested tag context managers were not properly closed before the Prompt context ended."
            )

        # Consistent with original behavior: clear internal state on exit.
        # This means results should typically be obtained (via render/dump_xml)
        # before the Prompt's 'with' block finishes if Prompt itself is a context manager.
        self.root_elements.clear()
        self.current_parent_stack.clear()

    def tag(self, tag_name: str, **attrs) -> _ImplicitDualTagHandler:
        return _ImplicitDualTagHandler(self, tag_name, attrs)


if __name__ == '__main__':
    # Example usage of the Prompt class
    with Prompt() as p:
        with p.paragraph():
            with p.task(id="task1", status="open"):
                p.text("This is a task description.")
            with p.paragraph():
                p.text("This is a paragraph in the document.")

        xml_output = p.dump_xml()  # Get pretty-printed XML for debugging
        print(xml_output)
        prompt_output = p.render()
        print(prompt_output)

        # <p>
        #   <Task id="task1" status="open">This is a task description.</Task>
        #   <p>This is a paragraph in the document.</p>
        # </p>
        # [{'speaker': 'human', 'content': '# Task\n\nThis is a task description.\n\nThis is a paragraph in the document.'}]
