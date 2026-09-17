# video_server.py
import http.server
import os
import socketserver
import sys
import threading
import urllib.parse

class RangeRequestHandler(http.server.BaseHTTPRequestHandler):
    """
    Serves an arbitrary absolute file path passed as a query parameter,
    e.g. http://127.0.0.1:8765/video?path=C%3A%5CShowImages%5CVideos%5Cclip.mp4

    Not tied to a single fixed root directory — this means it keeps working
    correctly even if the user changes their base directory in Settings
    later, with no need to restart the server or rebind it to a new folder.
    """

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)

        if parsed.path != "/video" or "path" not in query:
            self.send_error(404, "Not found")
            return

        file_path = urllib.parse.unquote(query["path"][0])

        if not os.path.isfile(file_path):
            self.send_error(404, "File not found")
            return

        file_size = os.path.getsize(file_path)
        mime_type = self._guess_mime(file_path)
        range_header = self.headers.get("Range")

        if range_header:
            start, end = self._parse_range(range_header, file_size)
            content_length = end - start + 1
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            self.send_header("Content-Length", str(content_length))
        else:
            start, end = 0, file_size - 1
            content_length = file_size
            self.send_response(200)
            self.send_header("Content-Length", str(content_length))

        self.send_header("Content-Type", mime_type)
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

        try:
            with open(file_path, 'rb') as f:
                f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk = f.read(min(64 * 1024, remaining))
                    if not chunk:
                        break
                    try:
                        self.wfile.write(chunk)
                    except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
                        # Client (WebView2) closed the connection mid-stream —
                        # normal during seeking/looping, not an error.
                        return
                    remaining -= len(chunk)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            return

    def _parse_range(self, header, file_size):
        _, range_spec = header.split("=")
        start_str, end_str = range_spec.split("-")
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
        return start, min(end, file_size - 1)

    def _guess_mime(self, file_path):
        ext = os.path.splitext(file_path)[1].lower()
        return {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mov": "video/quicktime",
            ".mkv": "video/x-matroska",
            ".pdf": "application/pdf",
        }.get(ext, "application/octet-stream")

    def log_message(self, format, *args):
        pass  # suppress default request logging to the console


class VideoHTTPServer(socketserver.ThreadingTCPServer):
    """
    Same as socketserver.ThreadingTCPServer, but silences the tracebacks
    socketserver normally prints to the terminal when a client (WebView2)
    aborts a connection mid-stream — expected during video seeking/looping,
    not an actual server error.
    """

    def handle_error(self, request, client_address):
        exc_type = sys.exc_info()[0]
        if exc_type in (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            return
        super().handle_error(request, client_address)


def start_video_server(start_port=8765, max_attempts=20):
    """
    Binds strictly to 127.0.0.1 (loopback only — never reachable from the
    network, which is what avoids the Windows Firewall prompt). Tries
    start_port, then increments if it's already in use.

    Returns the actual port that was bound.
    """
    port = start_port

    for _ in range(max_attempts):
        try:
            httpd = VideoHTTPServer(("127.0.0.1", port), RangeRequestHandler)
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            return port
        except OSError:
            port += 1

    raise RuntimeError("Could not find a free port for the video server")