"""
比特浏览器API封装
"""
import sys
import json
import requests

API_BASE = "http://127.0.0.1:54345"

def get_browser_list():
    """获取浏览器列表"""
    try:
        response = requests.post(f"{API_BASE}/browser/list", json={})
        return response.json()
    except Exception as e:
        return {"success": False, "message": str(e)}

def open_browser(browser_id):
    """打开浏览器窗口"""
    try:
        response = requests.post(
            f"{API_BASE}/browser/open",
            json={"id": browser_id}
        )
        return response.json()
    except Exception as e:
        return {"success": False, "message": str(e)}

def close_browser(browser_id):
    """关闭浏览器窗口"""
    try:
        response = requests.post(
            f"{API_BASE}/browser/close",
            json={"id": browser_id}
        )
        return response.json()
    except Exception as e:
        return {"success": False, "message": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "message": "缺少参数"}))
        sys.exit(1)

    action = sys.argv[1]

    if action == "list":
        result = get_browser_list()
    elif action == "open" and len(sys.argv) >= 3:
        result = open_browser(sys.argv[2])
    elif action == "close" and len(sys.argv) >= 3:
        result = close_browser(sys.argv[2])
    else:
        result = {"success": False, "message": "未知操作"}

    print(json.dumps(result, ensure_ascii=False))
