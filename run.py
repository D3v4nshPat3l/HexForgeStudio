#!/usr/bin/env python3
"""
HexForge Studio -- local launcher.

Creates an isolated virtual environment, installs the server dependencies into it,
then serves the built application on localhost and opens a browser.

    python run.py

The application itself runs entirely in the browser. This launcher exists so the
project starts with one command and a predictable Python environment, rather than
requiring a Node toolchain on the analyst's machine.
"""

from __future__ import annotations

import os
import subprocess
import sys
import venv
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV = ROOT / ".venv"
REQUIREMENTS = ROOT / "requirements.txt"
MIN_PYTHON = (3, 9)


def _venv_python() -> Path:
    """Interpreter inside the virtual environment, per-platform."""
    if os.name == "nt":
        return VENV / "Scripts" / "python.exe"
    return VENV / "bin" / "python"


def _ensure_environment() -> Path:
    python = _venv_python()
    if not python.exists():
        print("[hexforge] creating virtual environment in .venv ...")
        venv.EnvBuilder(with_pip=True, clear=False).create(VENV)
        python = _venv_python()
        if not python.exists():
            raise SystemExit(
                "Failed to create the virtual environment. On Debian/Ubuntu you may "
                "need: sudo apt install python3-venv"
            )

    # A marker keeps repeat launches fast; pip is only invoked when requirements change.
    stamp = VENV / ".requirements-stamp"
    current = REQUIREMENTS.read_text(encoding="utf-8") if REQUIREMENTS.exists() else ""
    if stamp.exists() and stamp.read_text(encoding="utf-8") == current:
        return python

    # A release currently has no third-party server dependencies. Avoid touching
    # the network (or even invoking pip) when requirements.txt contains comments
    # and blank lines only. If dependencies are added later, the normal pinned
    # installation path below activates automatically.
    specifications = [
        line.strip()
        for line in current.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if not specifications:
        stamp.write_text(current, encoding="utf-8")
        return python

    print("[hexforge] installing server dependencies ...")
    subprocess.check_call(
        [str(python), "-m", "pip", "install", "--quiet", "--disable-pip-version-check",
         "--upgrade", "pip"]
    )
    if REQUIREMENTS.exists():
        subprocess.check_call(
            [str(python), "-m", "pip", "install", "--quiet",
             "--disable-pip-version-check", "-r", str(REQUIREMENTS)]
        )
    stamp.write_text(current, encoding="utf-8")
    return python


def main() -> int:
    if sys.version_info < MIN_PYTHON:
        raise SystemExit(
            f"Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]} or newer is required; "
            f"found {sys.version.split()[0]}."
        )

    # Re-exec inside the virtual environment so the server always runs with the
    # pinned dependencies rather than whatever the system interpreter happens to have.
    if sys.prefix == sys.base_prefix:
        python = _ensure_environment()
        os.environ["HEXFORGE_BOOTSTRAPPED"] = "1"
        return subprocess.call([str(python), str(ROOT / "launcher" / "serve.py"), *sys.argv[1:]])

    return subprocess.call([sys.executable, str(ROOT / "launcher" / "serve.py"), *sys.argv[1:]])


if __name__ == "__main__":
    raise SystemExit(main())
