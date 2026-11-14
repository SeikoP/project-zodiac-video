"""Private, read-only preview origin. Never serves source paths or shell APIs."""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import secrets
import threading


class PreviewServer:
    def __init__(self, resource):
        self.token = secrets.token_urlsafe(32)
        token = self.token

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                parts = self.path.split("?")[0].split("/")
                if len(parts) != 5 or parts[1] != token:
                    self.send_error(404)
                    return
                try:
                    data = resource(parts[2], parts[3], parts[4])
                except Exception:
                    self.send_error(404)
                    return
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, *_):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = f"http://127.0.0.1:{self.server.server_port}"

    def url(self, project_id, build_id, scene_id):
        return f"{self.origin}/{self.token}/{project_id}/{build_id}/{scene_id}.html"

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
