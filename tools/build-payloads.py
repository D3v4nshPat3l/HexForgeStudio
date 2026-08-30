#!/usr/bin/env python3
"""
Builds the injector payload library from an upstream payload archive.

Reads markdown and wordlist files out of the zip, pulls payload strings from fenced
code blocks and list files, groups them by top-level directory and then by document,
and writes a JSON bundle the application loads on demand.

This only ever reads and rewrites text. Nothing extracted here is executed.

    python tools/build-payloads.py <archive.zip> public/payloads.json
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path

# Directories that hold prose, tooling, or images rather than payloads.
SKIP_DIRS = {".github", "Methodology and Resources", "_template_vuln", "Images"}

# Lines that are shell transcripts, prose, or markdown furniture rather than payloads.
NOISE = re.compile(
    r"^\s*(#|//|/\*|\*|<!--|\$ |> |PS[ >]|C:\\\\>|root@|user@|www-data@|\[.*\]\s*$)"
)

# Fenced code blocks, capturing the info string so transcripts can be down-weighted.
FENCE = re.compile(r"^```([A-Za-z0-9_+-]*)\s*$")

# Headings, used to name the group a payload came from.
HEADING = re.compile(r"^(#{2,4})\s+(.*?)\s*#*\s*$")

MAX_PAYLOAD_LEN = 4000
MIN_PAYLOAD_LEN = 2


def clean_title(text: str) -> str:
    """Strips markdown links and inline code markers out of a heading."""
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = text.replace("`", "").replace("*", "").strip()
    return re.sub(r"\s+", " ", text)


def looks_like_payload(line: str) -> bool:
    stripped = line.strip()
    if len(stripped) < MIN_PAYLOAD_LEN or len(stripped) > MAX_PAYLOAD_LEN:
        return False
    if NOISE.match(stripped):
        return False
    # Pure prose sentences slip into code blocks; require some non-word character
    # or a recognisably technical shape.
    if re.fullmatch(r"[A-Za-z][A-Za-z ,.'-]{10,}", stripped):
        return False
    return True


def extract_markdown(text: str) -> list[tuple[str, str]]:
    """Returns (group title, payload) pairs from one markdown document."""
    out: list[tuple[str, str]] = []
    heading = ""
    in_fence = False
    lang = ""

    for raw in text.splitlines():
        fence = FENCE.match(raw)
        if fence:
            if in_fence:
                in_fence = False
                lang = ""
            else:
                in_fence = True
                lang = fence.group(1).lower()
            continue

        if not in_fence:
            found = HEADING.match(raw)
            if found:
                heading = clean_title(found.group(2))
            continue

        # Session transcripts are mostly output, not payloads.
        if lang in {"console", "shell-session", "text"} and raw.strip().startswith(("$", ">")):
            continue
        if looks_like_payload(raw):
            out.append((heading, raw.rstrip()))

    return out


def extract_wordlist(text: str) -> list[str]:
    return [line.rstrip() for line in text.splitlines() if looks_like_payload(line)]


def build(archive: Path) -> dict:
    zf = zipfile.ZipFile(archive)
    categories: dict[str, dict[str, list[dict]]] = {}

    for name in zf.namelist():
        parts = name.split("/")
        if len(parts) < 3:
            continue
        category = parts[1]
        if not category or category in SKIP_DIRS:
            continue
        if any(part in SKIP_DIRS for part in parts[1:-1]):
            continue

        lower = name.lower()
        if lower.endswith(".md"):
            raw = zf.read(name).decode("utf-8", "replace")
            document = clean_title(Path(parts[-1]).stem)
            pairs = extract_markdown(raw)
            if not pairs:
                continue
            group = categories.setdefault(category, {}).setdefault(document, [])
            for heading, value in pairs:
                group.append({"n": heading or document, "v": value})

        elif lower.endswith(".txt"):
            raw = zf.read(name).decode("utf-8", "replace")
            document = clean_title(Path(parts[-1]).stem)
            values = extract_wordlist(raw)
            if not values:
                continue
            group = categories.setdefault(category, {}).setdefault(document, [])
            for value in values:
                group.append({"n": document, "v": value})

    # Deduplicate by value inside each document, preserving order.
    bundle = []
    for category in sorted(categories):
        documents = []
        for document in sorted(categories[category]):
            seen: set[str] = set()
            items = []
            for entry in categories[category][document]:
                if entry["v"] in seen:
                    continue
                seen.add(entry["v"])
                items.append(entry)
            if items:
                documents.append({"name": document, "items": items})
        if documents:
            bundle.append({"name": category, "groups": documents})
    return {"categories": bundle}


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    archive, destination = Path(sys.argv[1]), Path(sys.argv[2])
    bundle = build(archive)

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(bundle, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    categories = len(bundle["categories"])
    groups = sum(len(c["groups"]) for c in bundle["categories"])
    payloads = sum(len(g["items"]) for c in bundle["categories"] for g in c["groups"])
    size = destination.stat().st_size
    print(f"categories={categories} groups={groups} payloads={payloads} bytes={size:,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
