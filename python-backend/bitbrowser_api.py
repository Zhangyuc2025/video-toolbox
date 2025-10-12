"""
比特浏览器API封装（完整版）
支持浏览器的增删改查、Cookie同步、代理配置等操作
"""
import sys
import json
import requests
from typing import Dict, List, Optional, Any

API_BASE = "http://127.0.0.1:54345"


class BitBrowserAPI:
    """比特浏览器API客户端"""

    def __init__(self, api_base: str = API_BASE):
        self.api_base = api_base
        self.session = requests.Session()

    def _request(self, endpoint: str, data: dict = None) -> Dict[str, Any]:
        """
        发送POST请求到比特浏览器API

        Args:
            endpoint: API端点（如 /browser/list）
            data: 请求数据

        Returns:
            API响应的JSON数据
        """
        try:
            url = f"{self.api_base}{endpoint}"
            response = self.session.post(url, json=data or {}, timeout=10)
            return response.json()
        except requests.exceptions.Timeout:
            return {"success": False, "message": "请求超时"}
        except requests.exceptions.ConnectionError:
            return {"success": False, "message": "连接失败，请检查比特浏览器是否运行"}
        except Exception as e:
            return {"success": False, "message": f"请求异常: {str(e)}"}

    # ========== 浏览器基础操作 ==========

    def get_browser_list(self, page: int = 0, page_size: int = 100) -> Dict[str, Any]:
        """
        获取浏览器列表

        Args:
            page: 页码（从0开始）
            page_size: 每页数量

        Returns:
            {"success": bool, "data": [...], "message": str}
        """
        return self._request("/browser/list", {"page": page, "pageSize": page_size})

    def get_browser_detail(self, browser_id: str) -> Dict[str, Any]:
        """
        获取浏览器详情

        Args:
            browser_id: 浏览器ID

        Returns:
            {"success": bool, "data": {...}, "message": str}
        """
        return self._request("/browser/detail", {"id": browser_id})

    def open_browser(self, browser_id: str, load_extensions: bool = True) -> Dict[str, Any]:
        """
        打开浏览器窗口

        Args:
            browser_id: 浏览器ID
            load_extensions: 是否加载扩展

        Returns:
            {"success": bool, "data": {"ws": {...}, "http": "..."}, "message": str}
        """
        return self._request(
            "/browser/open", {"id": browser_id, "loadExtensions": load_extensions}
        )

    def close_browser(self, browser_id: str) -> Dict[str, Any]:
        """
        关闭浏览器窗口

        Args:
            browser_id: 浏览器ID

        Returns:
            {"success": bool, "message": str}
        """
        return self._request("/browser/close", {"id": browser_id})

    def delete_browser(self, browser_ids: List[str]) -> Dict[str, Any]:
        """
        删除浏览器（支持批量）

        Args:
            browser_ids: 浏览器ID列表

        Returns:
            {"success": bool, "message": str}
        """
        return self._request("/browser/delete", {"ids": browser_ids})

    # ========== 浏览器创建和更新 ==========

    def create_browser(
        self,
        name: str,
        remark: str = "",
        proxy_type: str = "noproxy",
        proxy_config: Optional[Dict] = None,
        open_url: str = "",
    ) -> Dict[str, Any]:
        """
        创建浏览器

        Args:
            name: 浏览器名称
            remark: 备注
            proxy_type: 代理类型 (noproxy/http/https/socks5)
            proxy_config: 代理配置 {"host": "", "port": "", "username": "", "password": ""}
            open_url: 启动URL

        Returns:
            {"success": bool, "data": {"id": "..."}, "message": str}
        """
        data = {
            "name": name,
            "remark": remark,
            "proxyType": proxy_type,
            "openUrl": open_url,
        }

        # 添加代理配置
        if proxy_config and proxy_type != "noproxy":
            data.update(
                {
                    "host": proxy_config.get("host", ""),
                    "port": proxy_config.get("port", ""),
                    "proxyUserName": proxy_config.get("username", ""),
                    "proxyPassword": proxy_config.get("password", ""),
                }
            )

        return self._request("/browser/update", data)

    def update_browser(
        self,
        browser_id: str,
        name: Optional[str] = None,
        remark: Optional[str] = None,
        proxy_type: Optional[str] = None,
        proxy_config: Optional[Dict] = None,
        open_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        更新浏览器配置

        Args:
            browser_id: 浏览器ID
            name: 浏览器名称
            remark: 备注
            proxy_type: 代理类型
            proxy_config: 代理配置
            open_url: 启动URL

        Returns:
            {"success": bool, "message": str}
        """
        data = {"id": browser_id}

        if name is not None:
            data["name"] = name
        if remark is not None:
            data["remark"] = remark
        if proxy_type is not None:
            data["proxyType"] = proxy_type
        if open_url is not None:
            data["openUrl"] = open_url

        # 添加代理配置
        if proxy_config and proxy_type and proxy_type != "noproxy":
            data.update(
                {
                    "host": proxy_config.get("host", ""),
                    "port": proxy_config.get("port", ""),
                    "proxyUserName": proxy_config.get("username", ""),
                    "proxyPassword": proxy_config.get("password", ""),
                }
            )

        return self._request("/browser/update", data)

    # ========== Cookie 操作 ==========

    def sync_cookies(self, browser_id: str, cookies: List[Dict]) -> Dict[str, Any]:
        """
        同步Cookie到浏览器

        Args:
            browser_id: 浏览器ID
            cookies: Cookie列表
                [
                    {
                        "name": "session_id",
                        "value": "abc123",
                        "domain": ".weixin.qq.com",
                        "path": "/",
                        "expires": 1234567890,  # Unix时间戳（秒）
                        "httpOnly": True,
                        "secure": True
                    }
                ]

        Returns:
            {"success": bool, "message": str}
        """
        # 获取浏览器详情
        detail_result = self.get_browser_detail(browser_id)
        if not detail_result.get("success"):
            return detail_result

        browser_data = detail_result.get("data", {})

        # 将Cookie添加到浏览器配置中
        browser_data["cookiesList"] = cookies

        # 更新浏览器
        return self._request("/browser/update", browser_data)

    def get_cookies(self, browser_id: str) -> Dict[str, Any]:
        """
        获取浏览器的Cookie

        Args:
            browser_id: 浏览器ID

        Returns:
            {"success": bool, "data": {"cookies": [...]}, "message": str}
        """
        result = self.get_browser_detail(browser_id)
        if not result.get("success"):
            return result

        cookies = result.get("data", {}).get("cookiesList", [])
        return {"success": True, "data": {"cookies": cookies}, "message": "获取成功"}

    # ========== 代理操作 ==========

    def update_proxy(
        self, browser_id: str, proxy_type: str, proxy_config: Dict
    ) -> Dict[str, Any]:
        """
        更新浏览器代理配置

        Args:
            browser_id: 浏览器ID
            proxy_type: 代理类型 (noproxy/http/https/socks5)
            proxy_config: 代理配置

        Returns:
            {"success": bool, "message": str}
        """
        return self.update_browser(browser_id, proxy_type=proxy_type, proxy_config=proxy_config)

    # ========== 批量操作 ==========

    def batch_open_browsers(self, browser_ids: List[str]) -> Dict[str, Any]:
        """
        批量打开浏览器

        Args:
            browser_ids: 浏览器ID列表

        Returns:
            {"success": bool, "data": {"results": [...]}, "message": str}
        """
        results = []
        for browser_id in browser_ids:
            result = self.open_browser(browser_id)
            results.append({"id": browser_id, "success": result.get("success"), "message": result.get("message")})

        all_success = all(r["success"] for r in results)
        return {
            "success": all_success,
            "data": {"results": results},
            "message": f"成功打开 {sum(1 for r in results if r['success'])}/{len(results)} 个浏览器",
        }

    def batch_close_browsers(self, browser_ids: List[str]) -> Dict[str, Any]:
        """
        批量关闭浏览器

        Args:
            browser_ids: 浏览器ID列表

        Returns:
            {"success": bool, "data": {"results": [...]}, "message": str}
        """
        results = []
        for browser_id in browser_ids:
            result = self.close_browser(browser_id)
            results.append({"id": browser_id, "success": result.get("success"), "message": result.get("message")})

        all_success = all(r["success"] for r in results)
        return {
            "success": all_success,
            "data": {"results": results},
            "message": f"成功关闭 {sum(1 for r in results if r['success'])}/{len(results)} 个浏览器",
        }

    # ========== 检查和状态 ==========

    def check_connection(self) -> Dict[str, Any]:
        """
        检查与比特浏览器的连接状态

        Returns:
            {"success": bool, "message": str}
        """
        result = self.get_browser_list(page=0, page_size=1)
        if result.get("success"):
            return {"success": True, "message": "连接正常"}
        else:
            return {"success": False, "message": result.get("message", "连接失败")}


# ========== 命令行接口 ==========


def main():
    """命令行入口"""
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "message": "缺少参数"}, ensure_ascii=False))
        sys.exit(1)

    api = BitBrowserAPI()
    action = sys.argv[1]
    result = {"success": False, "message": "未知操作"}

    try:
        if action == "list":
            result = api.get_browser_list()

        elif action == "detail" and len(sys.argv) >= 3:
            browser_id = sys.argv[2]
            result = api.get_browser_detail(browser_id)

        elif action == "open" and len(sys.argv) >= 3:
            browser_id = sys.argv[2]
            result = api.open_browser(browser_id)

        elif action == "close" and len(sys.argv) >= 3:
            browser_id = sys.argv[2]
            result = api.close_browser(browser_id)

        elif action == "delete" and len(sys.argv) >= 3:
            browser_ids = sys.argv[2].split(",")
            result = api.delete_browser(browser_ids)

        elif action == "create":
            # 从stdin读取JSON参数
            params = json.loads(sys.stdin.read())
            result = api.create_browser(
                name=params.get("name"),
                remark=params.get("remark", ""),
                proxy_type=params.get("proxyType", "noproxy"),
                proxy_config=params.get("proxyConfig"),
                open_url=params.get("openUrl", ""),
            )

        elif action == "update":
            # 从stdin读取JSON参数
            params = json.loads(sys.stdin.read())
            result = api.update_browser(
                browser_id=params.get("id"),
                name=params.get("name"),
                remark=params.get("remark"),
                proxy_type=params.get("proxyType"),
                proxy_config=params.get("proxyConfig"),
                open_url=params.get("openUrl"),
            )

        elif action == "sync_cookies":
            # 从stdin读取JSON参数
            params = json.loads(sys.stdin.read())
            result = api.sync_cookies(
                browser_id=params.get("browserId"), cookies=params.get("cookies", [])
            )

        elif action == "check":
            result = api.check_connection()

    except json.JSONDecodeError:
        result = {"success": False, "message": "JSON参数解析失败"}
    except Exception as e:
        result = {"success": False, "message": f"执行失败: {str(e)}"}

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
