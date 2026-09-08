# main.py
import webview
from api import Api

if __name__ == "__main__":
    api = Api()
    window = webview.create_window(
        "ShowtimeSA",
        "frontend/index.html",
        js_api=api,
        width=1200,
        height=800,
    )
    webview.start(debug=True)  # debug=True gives you dev tools during development