#!/usr/bin/env python3
"""
Static server for the built HexForge Studio application.

Deliberately dependency-free (standard library only). The application is a
client-side workstation: this process serves files and does no analysis, receives no
uploads, and stores nothing. It binds to loopback only.
"""

from __future__ import annotations

import argparse
import http.server
import socket
import socketserver
import sys
import threading
import webbrowser
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
DEFAULT_PORT = 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    """Serves `dist/` with sane MIME types and no caching during local use."""

    # Windows registry entries frequently mislabel these, which breaks module
    # scripts and workers with a strict-MIME error. Pin them explicitly.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".wasm": "application/wasm",
        ".map": "application/json",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        # The workstation is local-first; deny embedding and cross-origin reads.
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        # Quiet by default; the launcher prints the one line that matters.
        if "--verbose" in sys.argv:
            super().log_message(format, *args)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def _free_port(preferred: int) -> int:
    """Returns `preferred` if bindable, otherwise an arbitrary free port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve HexForge Studio locally.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    if not (DIST / "index.html").exists():
        print(
            "[hexforge] dist/ is missing or empty.\n"
            "           The distributed archive ships a prebuilt dist/.\n"
            "           If you are working from source, build it first:\n"
            "               npm install && npm run build",
            file=sys.stderr,
        )
        return 1

    port = _free_port(args.port)
    url = f"http://127.0.0.1:{port}/"
    handler = partial(Handler, directory=str(DIST))

    with Server(("127.0.0.1", port), handler) as httpd:
        print("")
        print("   HexForge Studio")
        print(f"   running at  {url}")
        print("   press Ctrl+C to stop")
        print("")
        if not args.no_browser:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[hexforge] stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
