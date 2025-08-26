import os
import re
import subprocess

_SHA = None
_REPO = "https://github.com/microsoft/poml".rstrip("/")
_TOKEN = "__COMMIT_SHA__"


def _get_sha():
    sha = os.getenv("GITHUB_SHA") or os.getenv("CI_COMMIT_SHA")
    if sha:
        return sha
    try:
        return subprocess.check_output(["git", "rev-parse", "--verify", "HEAD"]).decode().strip()
    except Exception:
        raise RuntimeError("Could not determine git commit SHA. Please set GITHUB_SHA or CI_COMMIT_SHA.")


def on_config(config):
    global _SHA
    _SHA = _get_sha()
    return config


def on_page_markdown(markdown, **kwargs):
    if _TOKEN in markdown:
        markdown = markdown.replace(_TOKEN, _SHA)
    pattern = re.compile(rf"({re.escape(_REPO)}/(?:blob|tree)/)HEAD(/[^)\s#]*)(#[^)]+)?")
    markdown = pattern.sub(rf"\g<1>{_SHA}\g<2>\g<3>", markdown)
    return markdown
