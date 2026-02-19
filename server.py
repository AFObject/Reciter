from flask import Flask, request, jsonify, send_from_directory
import os
import json

# 初始化 Flask
# static_folder='.' 表示直接把当前根目录作为静态文件目录
app = Flask(__name__, static_folder='.', static_url_path='')

DATA_DIR = '/tmp'  # ⚠️ 关键修改：Vercel 只允许写入 /tmp 目录

@app.route('/')
def index():
    # 访问域名直接返回 index.html
    return send_from_directory('.', 'index.html')

@app.route('/save', methods=['POST'])
def save_data():
    try:
        request_data = request.json
        filename = request_data.get('filename')
        content = request_data.get('content')

        if not filename or content is None:
            return jsonify({'error': 'Missing filename or content'}), 400

        # ⚠️ 注意：/tmp 目录下的文件是临时的，过几分钟可能会消失
        # 如果要永久保存，必须改用数据库 (如 MongoDB / Postgres / Vercel KV)
        target_path = os.path.join(DATA_DIR, os.path.basename(filename))

        with open(target_path, 'w', encoding='utf-8') as f:
            json.dump(content, f, ensure_ascii=False, indent=2)

        print(f"Saved to temporary storage: {target_path}")
        return jsonify({'status': 'success', 'path': target_path})

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

# 这一行是必须的，为了兼容 Vercel
app = app

if __name__ == "__main__":
    # app.run()
    app.run(debug=True)
