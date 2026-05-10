"""SPA-aware static server — returns index.html for any non-asset path."""
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

BUILD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")


class SPAHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Strip query string and anchor
        path = self.path.split("?")[0].split("#")[0].lstrip("/")
        file_path = os.path.join(BUILD_DIR, path) if path else os.path.join(BUILD_DIR, "index.html")

        # Fall back to index.html for any path that isn't a real file
        if not os.path.isfile(file_path):
            file_path = os.path.join(BUILD_DIR, "index.html")

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            mime, _ = mimetypes.guess_type(file_path)
            self.send_response(200)
            self.send_header("Content-Type", mime or "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode())

    def log_message(self, format, *args):
        pass  # suppress logs


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 3000), SPAHandler)
    print(f"Serving {BUILD_DIR}")
    print("Frontend at http://localhost:3000")
    server.serve_forever()
