from poml import poml, Prompt


def test_basic():
    assert poml("<p>Hello, World!</p>") == [{"speaker": "human", "content": "Hello, World!"}]


def test_prompt():
    with Prompt() as p:
        with p.task(caption="My Task"):
            p.text("This is a task description.")
            with p.paragraph():
                with p.header():
                    p.text("Subheading")
                p.text("This is a paragraph in the document.")

        xml_output = p.dump_xml()
        print(xml_output)
        assert xml_output == (
            """<Task caption="My Task">This is a task description.<Paragraph>
    <Header>Subheading</Header>This is a paragraph in the document.</Paragraph>
</Task>"""
        )
        prompt_output = p.render()
        assert prompt_output == [
            {
                "speaker": "human",
                "content": "# My Task\n\nThis is a task description.\n\n## Subheading\n\nThis is a paragraph in the document.",
            }
        ]
