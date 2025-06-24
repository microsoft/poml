import os
import subprocess
import sys
from pathlib import Path
import multiprocessing

from poml import poml, Prompt, set_trace, clear_trace, get_trace


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
    run_dir = set_trace(True, tmp_path)
    assert run_dir is not None
    result = poml("<p>Dir</p>")
    set_trace(False)
    assert result == [{"speaker": "human", "content": "Dir"}]
    files = list(run_dir.glob("*_markup.poml"))
    assert len(files) == 1


def _mp_worker():
    poml("<p>MP</p>")


def test_multiprocessing_trace(tmp_path: Path):
    clear_trace()
    run_dir = set_trace(True, tmp_path)
    os.environ["POML_TRACE"] = str(run_dir)
    procs = [multiprocessing.Process(target=_mp_worker) for _ in range(3)]
    for p in procs:
        p.start()
    for p in procs:
        p.join()
    set_trace(False)
    os.environ.pop("POML_TRACE", None)
    assert len(list(run_dir.glob("*_markup.poml"))) == 3


def test_envvar_autotrace(tmp_path: Path):
    env = os.environ.copy()
    trace_dir = tmp_path / "run"
    env["POML_TRACE"] = str(trace_dir)
    script = "from poml import poml; poml('<p>E</p>')"
    subprocess.check_call([sys.executable, "-c", script], env=env)
    assert any(f.name.endswith("_markup.poml") for f in trace_dir.iterdir())
