#!/usr/bin/env python3
"""
Builds the connect-back command set from the upstream generator's data file.

Parses `js/data.js` from the reverse-shell-generator project into JSON grouped by
command type. The arrays in that file are already valid JSON, so they are located by
bracket matching and parsed directly -- the file is never executed.

    python tools/build-revshells.py tools/vendor/revshells-data.js public/revshells.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# `const <name>Commands = withCommandType(CommandType.<Type>, [ ... ]);`
BLOCK = re.compile(
    r"const\s+\w+\s*=\s*withCommandType\(\s*CommandType\.(\w+)\s*,\s*\[",
    re.MULTILINE,
)

# Human-facing labels and ordering for the interface.
TYPE_LABELS = {
    "ReverseShell": ("Reverse", "Connect back to a listener you control."),
    "BindShell": ("Bind", "Listen on the target and wait for you to connect in."),
    "MSFVenom": ("MSFVenom", "Payload generation commands for the Metasploit toolchain."),
    "HoaxShell": ("HoaxShell", "HTTP-based sessions, for egress that only allows web traffic."),
    "Assembled": ("Assembled", "Longer scripts and multi-step builds."),
}
TYPE_ORDER = ["ReverseShell", "BindShell", "MSFVenom", "HoaxShell", "Assembled"]


def match_array(source: str, open_index: int) -> str:
    """
    Returns the array literal starting at `open_index`.

    Both quote styles must be tracked. The long scripts are template literals and are
    full of braces and brackets; counting those as structure truncates the array.
    """
    depth = 0
    quote = ""
    escaped = False
    for i in range(open_index, len(source)):
        ch = source[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = ""
            continue
        if ch in ('"', "`"):
            quote = ch
        elif ch in "[{":
            depth += 1
        elif ch in "]}":
            depth -= 1
            if depth == 0:
                return source[open_index : i + 1]
    raise ValueError("Unterminated array in the source file.")


JS_ESCAPES = {
    "n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f", "v": "\v", "0": "\0",
    "\\": "\\", "'": "'", '"': '"', "`": "`", "$": "$", "\n": "",
}


def decode_js_string(body: str) -> str:
    """Resolves the escape sequences a JavaScript string literal may contain."""
    out: list[str] = []
    i = 0
    while i < len(body):
        ch = body[i]
        if ch != "\\":
            out.append(ch)
            i += 1
            continue
        nxt = body[i + 1] if i + 1 < len(body) else ""
        if nxt == "u" and len(body) >= i + 6:
            try:
                out.append(chr(int(body[i + 2 : i + 6], 16)))
                i += 6
                continue
            except ValueError:
                pass
        if nxt == "x" and len(body) >= i + 4:
            try:
                out.append(chr(int(body[i + 2 : i + 4], 16)))
                i += 4
                continue
            except ValueError:
                pass
        out.append(JS_ESCAPES.get(nxt, nxt))
        i += 2
    return "".join(out)


def to_json(raw: str) -> str:
    """
    Rewrites a JavaScript array literal into JSON.

    Three constructs in the upstream file are not valid JSON: escaped apostrophes
    inside double-quoted strings, template literals carrying the long multi-line
    scripts, and commented-out entries. Strings are decoded and re-emitted as JSON;
    comments are dropped, along with the trailing commas they can leave behind.
    """
    out: list[str] = []
    i = 0
    while i < len(raw):
        ch = raw[i]

        if ch == "/" and i + 1 < len(raw) and raw[i + 1] == "/":
            end = raw.find("\n", i)
            i = len(raw) if end == -1 else end
            continue
        if ch == "/" and i + 1 < len(raw) and raw[i + 1] == "*":
            end = raw.find("*/", i)
            i = len(raw) if end == -1 else end + 2
            continue

        if ch == '"':
            j = i + 1
            escaped = False
            while j < len(raw):
                if escaped:
                    escaped = False
                elif raw[j] == "\\":
                    escaped = True
                elif raw[j] == '"':
                    break
                j += 1
            out.append(json.dumps(decode_js_string(raw[i + 1 : j])))
            i = j + 1
            continue

        if ch == "`":
            j = i + 1
            escaped = False
            while j < len(raw):
                if escaped:
                    escaped = False
                elif raw[j] == "\\":
                    escaped = True
                elif raw[j] == "`":
                    break
                j += 1
            out.append(json.dumps(decode_js_string(raw[i + 1 : j])))
            i = j + 1
            continue

        out.append(ch)
        i += 1

    text = "".join(out)
    # Removing a commented-out entry can leave `,` followed by `]` or `}`.
    return re.sub(r",(\s*[}\]])", r"\1", text)


def build(source_path: Path) -> dict:
    source = source_path.read_text(encoding="utf-8")
    groups: dict[str, list[dict]] = {}

    for found in BLOCK.finditer(source):
        command_type = found.group(1)
        array_start = source.index("[", found.end() - 1)
        raw = match_array(source, array_start)
        entries = json.loads(to_json(raw))
        cleaned = []
        for entry in entries:
            name = str(entry.get("name", "")).strip()
            command = str(entry.get("command", ""))
            if not name or not command:
                continue
            meta = [str(m) for m in entry.get("meta", []) if isinstance(m, str)]
            cleaned.append({"name": name, "command": command, "meta": meta})
        if cleaned:
            groups.setdefault(command_type, []).extend(cleaned)

    ordered = []
    for command_type in TYPE_ORDER:
        if command_type not in groups:
            continue
        label, summary = TYPE_LABELS.get(command_type, (command_type, ""))
        ordered.append({
            "id": command_type,
            "label": label,
            "summary": summary,
            "items": groups[command_type],
        })
    # Anything the upstream file adds later that this script does not know about.
    for command_type, items in groups.items():
        if command_type in TYPE_ORDER:
            continue
        ordered.append({"id": command_type, "label": command_type, "summary": "", "items": items})

    return {"groups": ordered}


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    source, destination = Path(sys.argv[1]), Path(sys.argv[2])
    bundle = build(source)

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(bundle, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    total = sum(len(g["items"]) for g in bundle["groups"])
    longest = max((len(i["command"]) for g in bundle["groups"] for i in g["items"]), default=0)
    print(f"groups={len(bundle['groups'])} commands={total} longest={longest} bytes={destination.stat().st_size:,}")
    for group in bundle["groups"]:
        print(f"  {len(group['items']):>4}  {group['label']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
