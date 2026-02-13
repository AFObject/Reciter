import http.server
import socketserver
import json
import os

PORT = 1075
DATA_DIR = 'data'

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        # 拦截 /save 请求，用于保存文件
        if self.path == '/save':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                request_data = json.loads(post_data.decode('utf-8'))
                
                filename = request_data.get('filename')
                content = request_data.get('content')
                
                # 安全检查：只允许写入 data 目录
                target_path = os.path.join(DATA_DIR, os.path.basename(filename))
                
                # 写入 JSON 文件
                with open(target_path, 'w', encoding='utf-8') as f:
                    json.dump(content, f, ensure_ascii=False, indent=2)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
                print(f"Saved: {target_path}")
                
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                print(f"Error: {e}")
        else:
            # 其他 POST 请求交给父类处理（虽然通常静态服务器不处理POST）
            super().do_POST()

print(f"Server started at http://localhost:{PORT}")
print("Press Ctrl+C to stop")

# 确保 data 目录存在
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    httpd.serve_forever()