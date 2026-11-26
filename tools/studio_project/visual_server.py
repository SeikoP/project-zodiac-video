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
                media = isinstance(data, tuple)
                data, content_type = data if media else (data, 'text/html; charset=utf-8')
                total, start, end = len(data), 0, len(data)-1
                requested = self.headers.get('Range') if media else None
                if requested:
                    import re
                    match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested)
                    if not match or not any(match.groups()):
                        self.send_error(416)
                        return
                    left, right = match.groups()
                    start = int(left) if left else max(0, total-int(right))
                    end = min(total-1, int(right)) if left and right else total-1
                    if start >= total or end < start:
                        self.send_error(416)
                        return
                self.send_response(206 if requested else 200)
                self.send_header("Content-Type", content_type)
                if media:
                    self.send_header('Accept-Ranges', 'bytes')
                if requested:
                    self.send_header('Content-Range', f'bytes {start}-{end}/{total}')
                    data = data[start:end+1]
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

    def video_url(self, project_id, export_id):
        return f'{self.origin}/{self.token}/{project_id}/{export_id}/episode.mp4'

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
