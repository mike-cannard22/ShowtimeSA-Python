# api.py
import os
import json
import webview
import base64
import mimetypes
import webbrowser

CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".showtimesa_config.json")

class Api:
    def get_video_port(self):
        return self.video_port
    
    def open_link(self, url):
        webbrowser.open(url)
    
    def open_powerpoint(self, file_path):
        try:
            os.startfile(file_path)
            return True
        except Exception as e:
            print(f"[open_powerpoint] failed: {e}")
            return False
    
    def pick_folder(self):
        result = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
        return result[0] if result else None

    def list_files(self, folder_path):
        if not folder_path or not os.path.isdir(folder_path):
            return []
        return [
            {"name": name, "path": os.path.join(folder_path, name)}
            for name in os.listdir(folder_path)
            if os.path.isfile(os.path.join(folder_path, name))
        ]

    def save_config(self, base_directory):
        print(f"[save_config] writing to {CONFIG_PATH}: {base_directory}")
        with open(CONFIG_PATH, "w") as f:
            json.dump({"baseDirectory": base_directory}, f)
        print("[save_config] done")
        return True

    def load_config(self):
        print(f"[load_config] checking {CONFIG_PATH}")
        if not os.path.exists(CONFIG_PATH):
            print("[load_config] file does not exist")
            return None
        with open(CONFIG_PATH) as f:
            data = json.load(f)
            print(f"[load_config] loaded: {data}")
            return data.get("baseDirectory")

    def close_app(self):
        webview.windows[0].destroy()
        
    def get_image_data(self, file_path):
        if not os.path.isfile(file_path):
            return None
        mime_type, _ = mimetypes.guess_type(file_path)
        mime_type = mime_type or "image/jpeg"
        with open(file_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
        return f"data:{mime_type};base64,{encoded}"    