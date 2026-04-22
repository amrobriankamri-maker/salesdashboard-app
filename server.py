#!/usr/bin/env python3
"""
NETSCOUT Africa — Local Proxy Server (Python)
Open: http://localhost:8080
"""

import os
import json
import threading
import webbrowser
import http.server
import urllib.request
import urllib.error
from pathlib import Path
import sys

PORT = 8080

MIME = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.ico':  'image/x-icon',
}

def resource_path(relative_path: str) -> Path:
    """Work both in normal Python and in PyInstaller package."""
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / relative_path
    return Path(__file__).resolve().parent / relative_path

def get_api_key() -> str:
    return os.environ.get("ANTHROPIC_API_KEY", "").strip()

class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        if '/api/claude' in str(args[0] if args else ''):
            status = args[1] if len(args) > 1 else '?'
            print(f'  API → {status}')
        elif args and str(args[1] if len(args) > 1 else '') not in ('200', '304'):
            print(f'  {" ".join(str(a) for a in args)}')

    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key,anthropic-version')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.end_headers()

    def do_POST(self):
        if self.path != '/api/claude':
            self.send_response(404)
            self.end_headers()
            return

        api_key = get_api_key()

        if not api_key:
            self._json(500, {
                'error': 'ANTHROPIC_API_KEY not set. On Windows, set it before launching the app or use a launcher that sets it for you.'
            })
            return

        if not api_key.startswith('sk-ant-'):
            self._json(500, {
                'error': f'API key looks wrong (got: {api_key[:12]}...). It should start with sk-ant-'
            })
            return

        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)

        try:
            req = urllib.request.Request(
                'https://api.anthropic.com/v1/messages',
                data=body,
                method='POST',
                headers={
                    'Content-Type': 'application/json',
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                }
            )
            with urllib.request.urlopen(req) as resp:
                data, status = resp.read(), resp.status

        except urllib.error.HTTPError as e:
            data = e.read()
            status = e.code
            try:
                err = json.loads(data)
                print(f'  Anthropic error {status}: {err.get("error", {}).get("message", "unknown")}')
            except Exception:
                print(f'  Anthropic HTTP error: {status}')

        except Exception as e:
            self._json(502, {'error': str(e)})
            return

        self._raw(status, data)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/':
            path = '/index.html'

        fp = resource_path(path.lstrip('/'))

        if not fp.is_file():
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not found')
            return

        ext = fp.suffix.lower()
        data = fp.read_bytes()

        self.send_response(200)
        self.send_header('Content-Type', MIME.get(ext, 'text/plain'))
        self.send_cors()
        self.end_headers()
        self.wfile.write(data)

    def _json(self, status, obj):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_cors()
        self.end_headers()
        self.wfile.write(body)

    def _raw(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_cors()
        self.end_headers()
        self.wfile.write(data)

def open_browser():
    webbrowser.open(f'http://localhost:{PORT}')

if __name__ == '__main__':
    print('\n╔══════════════════════════════════════════════╗')
    print('║  NETSCOUT Africa · Sales Intelligence App   ║')
    print('╚══════════════════════════════════════════════╝')
    print(f'\n  App:  http://localhost:{PORT}')

    api_key = get_api_key()
    if api_key:
        print(f'  Key:  ✓ {api_key[:18]}...')
    else:
        print('  Key:  ✗ NOT SET')

    print()

    threading.Timer(1.5, open_browser).start()

    server = http.server.HTTPServer(('', PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Server stopped.\n')
