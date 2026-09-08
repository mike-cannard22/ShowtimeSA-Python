# main.py
import webview
from api import Api
from video_server import start_video_server

if __name__ == "__main__":
    video_port = start_video_server()

    api = Api()
    api.video_port = video_port  # so Api can hand this to JS

    window = webview.create_window(
        "ShowtimeSA",
        "frontend/index.html",
        js_api=api,
        width=1200,
        height=800,
    )
    webview.start(debug=True)  # debug=True gives you dev tools during development