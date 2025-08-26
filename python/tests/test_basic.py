import multiprocessing
import os
import re
import subprocess
import sys
from pathlib import Path

from poml import Prompt, clear_trace, get_trace, poml, set_trace, trace_artifact


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


def test_document():
    with open(Path(__file__).parent / "assets" / "pdf_latex_image.pdf", "rb") as f:
        pdf_contents = f.read()
    with Prompt() as p:
        with p.document(buffer=pdf_contents, parser="pdf"):
            p.text("This is a PDF document.")
        xml_output = p.dump_xml()
        assert "<Document" in xml_output
        assert "base64=" in xml_output

        result = p.render()
        assert isinstance(result, list)
        assert "Lorem ipsum" in result[0]["content"]


def test_prompt_reuse_appendable():
    """Ensure a Prompt instance can be reused across multiple context blocks."""

    prompt = Prompt()

    with prompt:
        with prompt.role():
            prompt.text("You are helpful.")
        with prompt.task(caption="First"):
            prompt.text("Describe A.")

    # Results should be available outside the context
    first_xml = prompt.dump_xml()
    assert first_xml.count("<Task") == 1
    first_render = prompt.render()
    assert "Describe A." in first_render[0]["content"]

    # Re-enter the context and append more content
    with prompt:
        with prompt.task(caption="Second"):
            prompt.text("Describe B.")

    second_xml = prompt.dump_xml()
    # Both tasks should be present
    assert second_xml.count("<Task") == 2
    second_render = prompt.render()
    assert "Describe A." in second_render[0]["content"]
    assert "Describe B." in second_render[0]["content"]


def test_trace():
    clear_trace()
    set_trace(True)
    result = poml("<p>Trace Me</p>")
    traces = get_trace()
    set_trace(False)
    assert result == [{"speaker": "human", "content": "Trace Me"}]
    assert len(traces) == 1
    assert "Trace Me" in traces[0]["markup"]


def test_trace_directory(tmp_path: Path):
    clear_trace()
    run_dir = set_trace(True, trace_dir=tmp_path)
    assert run_dir is not None
    result = poml("<p>Dir</p>")
    set_trace(False)
    assert result == [{"speaker": "human", "content": "Dir"}]
    files = list(run_dir.glob("*.poml"))
    assert len(files) == 2


def test_trace_artifact(tmp_path: Path):
    clear_trace()
    run_dir = set_trace(trace_dir=tmp_path)
    poml("<p>A</p>")
    trace_artifact("reply.txt", "hello")
    set_trace(False)
    artifacts = list(run_dir.glob("*.reply.txt"))
    assert len(artifacts) == 1
    assert artifacts[0].read_text().strip() == "hello"


def test_trace_prefix_regex(tmp_path: Path):
    clear_trace()
    run_dir = set_trace(True, trace_dir=tmp_path)
    src = tmp_path / "my.file.poml"
    src.write_text("<p>B</p>")
    poml(src)
    trace_artifact("custom.txt", "bye")
    set_trace(False)
    artifact = run_dir / "0001.my.file.custom.txt"
    assert artifact.exists()


def test_trace_directory_name_format(tmp_path: Path):
    clear_trace()
    run_dir = set_trace(trace_dir=tmp_path)
    assert run_dir is not None
    assert re.fullmatch(r"\d{20}", run_dir.name)
    set_trace(False)


def _mp_worker():
    poml("<p>MP</p>")


def test_multiprocessing_trace(tmp_path: Path):
    clear_trace()
    run_dir = set_trace(True, trace_dir=tmp_path)
    os.environ["POML_TRACE"] = str(run_dir)
    procs = [multiprocessing.Process(target=_mp_worker) for _ in range(3)]
    for p in procs:
        p.start()
    for p in procs:
        p.join()
    set_trace(False)
    os.environ.pop("POML_TRACE", None)
    assert len(list(run_dir.glob("*.poml"))) == 6


def test_envvar_autotrace(tmp_path: Path):
    env = os.environ.copy()
    trace_dir = tmp_path / "run"
    env["POML_TRACE"] = str(trace_dir)
    script = "from poml import poml; poml('<p>E</p>')"
    subprocess.check_call([sys.executable, "-c", script], env=env)
    assert any(f.name.endswith(".poml") for f in trace_dir.iterdir())
