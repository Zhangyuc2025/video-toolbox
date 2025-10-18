// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Sidecar 模块临时注释，等 Python API 准备好后再启用
// mod bitbrowser_sidecar;

// BitBrowser 管理模块
mod bitbrowser_manager;

// BitBrowser 新架构模块
mod bitbrowser_detector;
mod bitbrowser_launcher;
mod bitbrowser_monitor;

// 配置管理模块
mod config_manager;

use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::HashSet;
use std::process::Command;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
struct ApiResponse {
    success: bool,
    message: String,
    data: Option<serde_json::Value>,
}

// 浏览器信息结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserInfo {
    id: String,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    remark: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    created_name: Option<String>,
    is_running: bool,
}

// 应用运行时状态
struct AppState {
    // 浏览器列表缓存
    browser_list: Mutex<Vec<BrowserInfo>>,
    // 正在检测Cookie的浏览器ID集合
    checking_cookies: Mutex<HashSet<String>>,
    // 比特浏览器连接状态
    bitbrowser_connected: Mutex<bool>,
    // 后台监控任务运行标志
    monitor_running: Arc<AtomicBool>,
}

// ==================== 辅助函数 ====================

/// 获取比特浏览器 API 基础 URL（带错误处理）
async fn get_bb_api_url() -> Result<String, String> {
    bitbrowser_manager::get_api_base_url().await
}

/// 创建 HTTP 客户端（禁用代理以访问 localhost）
///
/// 重要：reqwest 默认会使用系统代理，即使访问 localhost 也可能通过代理，
/// 导致 502 错误。使用 .no_proxy() 禁用代理可以解决此问题。
fn create_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .no_proxy()  // 禁用代理（关键！）
        .build()
        .expect("Failed to create HTTP client")
}

/// 创建带超时的 HTTP 客户端
fn create_http_client_with_timeout(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .no_proxy()  // 禁用代理（关键！）
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))
}

// 获取比特浏览器状态（使用新的 detector）
#[tauri::command]
async fn check_bitbrowser_status() -> Result<ApiResponse, String> {
    use bitbrowser_detector::ConnectionStatus;

    let status = bitbrowser_detector::check_status().await;

    match status {
        ConnectionStatus::Connected { message } => Ok(ApiResponse {
            success: true,
            message,
            data: None,
        }),
        ConnectionStatus::Disconnected { message, .. } => Ok(ApiResponse {
            success: false,
            message,
            data: None,
        }),
    }
}

// 检查 BitBrowser 是否运行（别名命令）
#[tauri::command]
async fn check_bitbrowser_running() -> Result<ApiResponse, String> {
    check_bitbrowser_status().await
}

// 打开比特浏览器窗口
#[tauri::command]
async fn open_bitbrowser(browser_id: String) -> Result<ApiResponse, String> {
    let base_url = get_bb_api_url().await?;
    let client = create_http_client();
    match client
        .post(format!("{}/browser/open", base_url))
        .json(&serde_json::json!({
            "id": browser_id
        }))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok(ApiResponse {
                    success: true,
                    message: "浏览器打开成功".to_string(),
                    data: None,
                })
            } else {
                Ok(ApiResponse {
                    success: false,
                    message: "浏览器打开失败".to_string(),
                    data: None,
                })
            }
        }
        Err(e) => Ok(ApiResponse {
            success: false,
            message: format!("API调用失败: {}", e),
            data: None,
        }),
    }
}

// 调用Python脚本（示例）
#[tauri::command]
fn call_python_script(script_name: String, args: Vec<String>) -> Result<String, String> {
    let output = Command::new("python")
        .arg(format!("../python-backend/{}", script_name))
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// 获取缓存的浏览器列表
#[tauri::command]
fn get_cached_browser_list(state: tauri::State<AppState>) -> Vec<BrowserInfo> {
    let list = state.browser_list.lock().unwrap();
    list.clone()
}

// 更新浏览器列表缓存
#[tauri::command]
fn update_browser_cache(state: tauri::State<AppState>, browsers: Vec<BrowserInfo>) {
    let mut list = state.browser_list.lock().unwrap();
    *list = browsers;
}

// 检查Cookie是否正在检测中
#[tauri::command]
fn is_cookie_checking(state: tauri::State<AppState>, browser_id: String) -> bool {
    let checking = state.checking_cookies.lock().unwrap();
    checking.contains(&browser_id)
}

// 添加到正在检测的集合
#[tauri::command]
fn add_checking_cookie(state: tauri::State<AppState>, browser_id: String) {
    let mut checking = state.checking_cookies.lock().unwrap();
    checking.insert(browser_id);
}

// 从正在检测的集合中移除
#[tauri::command]
fn remove_checking_cookie(state: tauri::State<AppState>, browser_id: String) {
    let mut checking = state.checking_cookies.lock().unwrap();
    checking.remove(&browser_id);
}

// 获取比特浏览器连接状态
#[tauri::command]
fn get_bitbrowser_status(state: tauri::State<AppState>) -> bool {
    let status = state.bitbrowser_connected.lock().unwrap();
    *status
}

// 更新比特浏览器连接状态
#[tauri::command]
fn update_bitbrowser_status(state: tauri::State<AppState>, connected: bool) {
    let mut status = state.bitbrowser_connected.lock().unwrap();
    *status = connected;
}

// ==================== BitBrowser 管理命令 ====================

// 查找 BitBrowser 路径
#[tauri::command]
fn find_bitbrowser() -> Result<ApiResponse, String> {
    match bitbrowser_manager::find_bitbrowser_path() {
        Some(path) => Ok(ApiResponse {
            success: true,
            message: "找到 BitBrowser".to_string(),
            data: Some(serde_json::json!({ "path": path })),
        }),
        None => Ok(ApiResponse {
            success: false,
            message: "未找到 BitBrowser 安装路径".to_string(),
            data: None,
        }),
    }
}

// 获取 BitBrowser 运行信息
#[tauri::command]
fn get_bitbrowser_info() -> Result<ApiResponse, String> {
    let info = bitbrowser_manager::get_running_bitbrowser_info();

    Ok(ApiResponse {
        success: info.is_some(),
        message: if info.is_some() {
            "BitBrowser 正在运行".to_string()
        } else {
            "BitBrowser 未运行".to_string()
        },
        data: info.map(|i| serde_json::to_value(i).unwrap()),
    })
}

// 启动 BitBrowser（使用新的 launcher）
#[tauri::command]
async fn launch_bitbrowser(path: Option<String>) -> Result<ApiResponse, String> {
    let result = bitbrowser_launcher::launch(path).await;

    Ok(ApiResponse {
        success: result.success,
        message: result.message,
        data: None,
    })
}

// 停止 BitBrowser
#[tauri::command]
fn stop_bitbrowser() -> Result<ApiResponse, String> {
    match bitbrowser_manager::kill_bitbrowser() {
        Ok(_) => Ok(ApiResponse {
            success: true,
            message: "BitBrowser 已停止".to_string(),
            data: None,
        }),
        Err(e) => Ok(ApiResponse {
            success: false,
            message: e,
            data: None,
        }),
    }
}

// 清除 BitBrowser 路径缓存
#[tauri::command]
fn clear_bitbrowser_cache() -> Result<ApiResponse, String> {
    bitbrowser_manager::clear_cached_path();
    Ok(ApiResponse {
        success: true,
        message: "路径缓存已清除".to_string(),
        data: None,
    })
}

// 关闭指定 PID 的进程
#[tauri::command]
fn kill_process_by_pid(pid: u32) -> Result<ApiResponse, String> {
    use sysinfo::System;

    let mut system = System::new_all();
    system.refresh_processes();

    let sys_pid = sysinfo::Pid::from_u32(pid);

    if let Some(process) = system.process(sys_pid) {
        if process.kill() {
            Ok(ApiResponse {
                success: true,
                message: format!("已关闭进程 PID: {}", pid),
                data: None,
            })
        } else {
            Ok(ApiResponse {
                success: false,
                message: format!("无法关闭进程 PID: {}", pid),
                data: None,
            })
        }
    } else {
        Ok(ApiResponse {
            success: false,
            message: format!("未找到进程 PID: {}", pid),
            data: None,
        })
    }
}

// ==================== 微信登录相关 ====================

// 登录状态存储
struct LoginState {
    tokens: Mutex<HashMap<String, String>>, // qrUrl -> token (视频号助手)
    shop_tickets: Mutex<HashMap<String, String>>, // qrUrl -> qr_ticket (微信小店带货助手)
}

// 生成登录二维码
#[tauri::command]
async fn generate_login_qr(
    login_method: String,
    state: tauri::State<'_, LoginState>,
) -> Result<serde_json::Value, String> {
    if login_method == "channels_helper" {
        // 视频号助手登录
        generate_channels_helper_qr(state).await
    } else if login_method == "shop_helper" {
        // 微信小店带货助手登录
        generate_shop_helper_qr(state).await
    } else {
        Err("不支持的登录方式".to_string())
    }
}

// 视频号助手二维码生成
async fn generate_channels_helper_qr(
    state: tauri::State<'_, LoginState>,
) -> Result<serde_json::Value, String> {
    use uuid::Uuid;

    let client = create_http_client_with_timeout(30)?;

    let aid = Uuid::new_v4().to_string();
    let rid = Uuid::new_v4().to_string().replace("-", "");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string();

    let url = "https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/auth/auth_login_code";

    let mut params = HashMap::new();
    params.insert("_aid", aid.clone());
    params.insert("_rid", rid);
    params.insert(
        "_pageUrl",
        "https://channels.weixin.qq.com/platform/login-for-iframe".to_string(),
    );

    let body = serde_json::json!({
        "timestamp": timestamp,
        "_log_finder_uin": "",
        "_log_finder_id": "",
        "rawKeyBuff": null,
        "pluginSessionId": null,
        "scene": 7,
        "reqScene": 7
    });

    let response = client
        .post(url)
        .header("Accept", "application/json, text/plain, */*")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .header("Content-Type", "application/json")
        .header("X-WECHAT-UIN", "0000000000")
        .header("finger-print-device-id", "b8bcbb2d1509f0ed1034054bbd247253")
        .query(&params)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if result["errCode"].as_i64() == Some(0) {
        let token = result["data"]["token"]
            .as_str()
            .ok_or("获取token失败")?
            .to_string();

        // 生成二维码URL
        let qr_url_str = format!(
            "https://channels.weixin.qq.com/mobile/confirm_login.html?token={}",
            token
        );

        // 生成二维码图片
        let qr_code = qrcode::QrCode::new(qr_url_str.as_bytes())
            .map_err(|e| format!("生成二维码失败: {}", e))?;

        // 转换为PNG图片
        let image = qr_code.render::<image::Luma<u8>>().build();

        // 转换为base64
        let mut png_data = Vec::new();
        image::DynamicImage::ImageLuma8(image)
            .write_to(
                &mut std::io::Cursor::new(&mut png_data),
                image::ImageOutputFormat::Png,
            )
            .map_err(|e| format!("转换图片失败: {}", e))?;

        let base64_image = general_purpose::STANDARD.encode(&png_data);
        let qr_url = format!("data:image/png;base64,{}", base64_image);

        // 设置过期时间（5分钟后）
        let expire_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + 300;

        // 保存 qrUrl -> token 映射（用于后续状态检查）
        {
            let mut tokens = state.tokens.lock().unwrap();
            tokens.insert(qr_url.clone(), token);
        }

        Ok(serde_json::json!({
            "qrUrl": qr_url,
            "expireTime": expire_time
        }))
    } else {
        let err_msg = result["errMsg"].as_str().unwrap_or("未知错误");
        Err(format!("生成二维码失败: {}", err_msg))
    }
}

// 微信小店带货助手二维码生成
async fn generate_shop_helper_qr(
    state: tauri::State<'_, LoginState>,
) -> Result<serde_json::Value, String> {
    let client = create_http_client_with_timeout(30)?;

    let url = "https://store.weixin.qq.com/shop-faas/mmeckolnode/getLoginQrCode";

    let response = client
        .get(url)
        .query(&[
            ("token", ""),
            ("lang", "zh_CN"),
            ("isRelease", "1"),
            ("entryType", "9")
        ])
        .header("Accept", "application/json, text/plain, */*")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")
        .header("Referer", "https://store.weixin.qq.com/talent/?redirect_url=%2Fhome")
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    // 检查响应
    if result["code"].as_i64() == Some(0) {
        let qr_ticket = result["qrTicket"]
            .as_str()
            .ok_or_else(|| {
                format!(
                    "获取qrTicket失败，响应数据: {}",
                    serde_json::to_string(&result).unwrap_or_default()
                )
            })?
            .to_string();

        let qrcode_img = result["qrcodeImg"]
            .as_str()
            .ok_or_else(|| {
                format!(
                    "获取qrcodeImg失败，响应数据: {}",
                    serde_json::to_string(&result).unwrap_or_default()
                )
            })?
            .to_string();

        // API直接返回了base64编码的二维码图片，添加data URL前缀
        let qr_url = format!("data:image/jpeg;base64,{}", qrcode_img);

        // 设置过期时间（5分钟后）
        let expire_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + 300;

        // 保存 qrUrl -> qr_ticket 映射（用于后续状态检查）
        {
            let mut tickets = state.shop_tickets.lock().unwrap();
            tickets.insert(qr_url.clone(), qr_ticket);
        }

        Ok(serde_json::json!({
            "qrUrl": qr_url,
            "expireTime": expire_time
        }))
    } else {
        let err_code = result["code"].as_i64().unwrap_or(-1);
        let err_msg = result["msg"].as_str().unwrap_or("未知错误");
        Err(format!(
            "生成二维码失败 (code: {}): {}，完整响应: {}",
            err_code,
            err_msg,
            serde_json::to_string(&result).unwrap_or_default()
        ))
    }
}

// 检查二维码状态
#[tauri::command]
async fn check_qr_status(
    login_method: String,
    qr_url: String,
    state: tauri::State<'_, LoginState>,
) -> Result<serde_json::Value, String> {
    if login_method == "channels_helper" {
        check_channels_helper_status(qr_url, state).await
    } else if login_method == "shop_helper" {
        check_shop_helper_status(qr_url, state).await
    } else {
        Err("不支持的登录方式".to_string())
    }
}

// 检查视频号助手扫码状态
async fn check_channels_helper_status(
    qr_url: String,
    state: tauri::State<'_, LoginState>,
) -> Result<serde_json::Value, String> {
    use uuid::Uuid;

    // 根据 qrUrl 获取对应的 token
    let token = {
        let tokens = state.tokens.lock().unwrap();
        tokens
            .get(&qr_url)
            .ok_or("未找到登录token，请重新生成二维码")?
            .clone()
    };

    let client = create_http_client_with_timeout(10)?;

    let aid = Uuid::new_v4().to_string();
    let rid = Uuid::new_v4().to_string().replace("-", "");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string();

    let url = "https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/auth/auth_login_status";

    let mut params = HashMap::new();
    params.insert("token", token.clone());
    params.insert("timestamp", timestamp.clone());
    params.insert("_log_finder_uin", "".to_string());
    params.insert("_log_finder_id", "".to_string());
    params.insert("scene", "7".to_string());
    params.insert("reqScene", "7".to_string());
    params.insert("_aid", aid);
    params.insert("_rid", rid);
    params.insert(
        "_pageUrl",
        "https://channels.weixin.qq.com/platform/login-for-iframe".to_string(),
    );

    let body = serde_json::json!({
        "token": token,
        "timestamp": timestamp,
        "_log_finder_uin": "",
        "_log_finder_id": "",
        "rawKeyBuff": null,
        "pluginSessionId": null,
        "scene": 7,
        "reqScene": 7
    });

    let response = client
        .post(url)
        .header("Accept", "application/json, text/plain, */*")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .header("Content-Type", "application/json")
        .header("X-WECHAT-UIN", "0000000000")
        .header("finger-print-device-id", "b8bcbb2d1509f0ed1034054bbd247253")
        .query(&params)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    // 先提取cookies（在消费response之前）
    let cookies: Vec<_> = response
        .cookies()
        .map(|c| (c.name().to_string(), c.value().to_string()))
        .collect();

    // 然后解析JSON（这会消费response）
    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let status = result["data"]["status"].as_i64().unwrap_or(-1);

    match status {
        1 => {
            // 登录成功，打印完整的API响应和cookies
            println!("╔══════════════════════════════════════════════════════════╗");
            println!("║         视频号助手 - 登录成功 - 完整数据                ║");
            println!("╚══════════════════════════════════════════════════════════╝");
            println!("\n【JSON 响应体】");
            println!(
                "{}",
                serde_json::to_string_pretty(&result).unwrap_or_default()
            );
            println!("\n【HTTP Cookies】");
            for (name, value) in &cookies {
                println!("  {} = {}", name, value);
            }
            println!("\n══════════════════════════════════════════════════════════\n");

            // 提取cookie字符串
            let mut cookie_str = String::new();
            for (name, value) in &cookies {
                if !cookie_str.is_empty() {
                    cookie_str.push_str("; ");
                }
                cookie_str.push_str(&format!("{}={}", name, value));
            }

            // 调用API获取用户信息
            let aid = Uuid::new_v4().to_string();
            let rid = Uuid::new_v4().to_string();
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
                .to_string();

            let user_info_url =
                "https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/auth/auth_data";

            let user_info_body = serde_json::json!({
                "timestamp": timestamp,
                "_log_finder_uin": null,
                "_log_finder_id": "",
                "rawKeyBuff": null,
                "pluginSessionId": null,
                "scene": 7,
                "reqScene": 7
            });

            let user_info_response = client
                .post(user_info_url)
                .query(&[
                    ("_aid", aid.as_str()),
                    ("_rid", rid.as_str()),
                    ("_pageUrl", "https://channels.weixin.qq.com/platform")
                ])
                .header("Accept", "application/json, text/plain, */*")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
                .header("Content-Type", "application/json")
                .header("Cookie", &cookie_str)
                .header("X-WECHAT-UIN", "0000000000")
                .header("finger-print-device-id", "b8bcbb2d1509f0ed1034054bbd247253")
                .json(&user_info_body)
                .send()
                .await;

            let (nickname, avatar, wechat_id) = match user_info_response {
                Ok(resp) => {
                    if let Ok(user_data) = resp.json::<serde_json::Value>().await {
                        println!("\n【获取用户信息成功】");
                        println!(
                            "{}",
                            serde_json::to_string_pretty(&user_data).unwrap_or_default()
                        );

                        let nickname = user_data["data"]["userAttr"]["nickname"]
                            .as_str()
                            .unwrap_or("用户")
                            .to_string();
                        let avatar = user_data["data"]["userAttr"]["encryptedHeadImage"]
                            .as_str()
                            .unwrap_or("")
                            .to_string();
                        let wechat_id = user_data["data"]["userAttr"]["encryptedUsername"]
                            .as_str()
                            .unwrap_or("")
                            .to_string();

                        (nickname, avatar, wechat_id)
                    } else {
                        ("用户".to_string(), "".to_string(), "".to_string())
                    }
                }
                Err(e) => {
                    println!("获取用户信息失败: {}", e);
                    ("用户".to_string(), "".to_string(), "".to_string())
                }
            };

            Ok(serde_json::json!({
                "success": true,
                "scanned": true,
                "expired": false,
                "cookie": cookie_str,
                "nickname": nickname,
                "avatar": avatar,
                "wechatId": wechat_id
            }))
        }
        0 => {
            // 等待扫码
            Ok(serde_json::json!({
                "success": false,
                "scanned": false,
                "expired": false
            }))
        }
        5 => {
            // 已扫码，等待确认
            Ok(serde_json::json!({
                "success": false,
                "scanned": true,
                "expired": false
            }))
        }
        4 => {
            // 用户取消或过期
            Ok(serde_json::json!({
                "success": false,
                "scanned": false,
                "expired": true
            }))
        }
        _ => {
            let err_msg = result["errMsg"].as_str().unwrap_or("未知状态");
            Err(format!("状态检查失败: {}", err_msg))
        }
    }
}

// 检查微信小店带货助手扫码状态
async fn check_shop_helper_status(
    qr_url: String,
    state: tauri::State<'_, LoginState>,
) -> Result<serde_json::Value, String> {
    // 根据 qrUrl 获取对应的 qr_ticket
    let qr_ticket = {
        let tickets = state.shop_tickets.lock().unwrap();
        tickets
            .get(&qr_url)
            .ok_or("未找到qrTicket，请重新生成二维码")?
            .clone()
    };

    let client = create_http_client_with_timeout(10)?;

    let url = "https://store.weixin.qq.com/shop-faas/mmeckolnode/queryLoginQrCode";

    let response = client
        .get(url)
        .query(&[
            ("token", ""),
            ("lang", "zh_CN"),
            ("qr_ticket", qr_ticket.as_str())
        ])
        .header("Accept", "application/json, text/plain, */*")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")
        .header("Referer", "https://store.weixin.qq.com/talent/?redirect_url=%2Fhome")
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    // 先提取cookies（在消费response之前）
    let cookies: Vec<_> = response
        .cookies()
        .map(|c| (c.name().to_string(), c.value().to_string()))
        .collect();

    // 然后解析JSON（这会消费response）
    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    // 检查响应状态
    if result["code"].as_i64() != Some(0) {
        let err_msg = result["msg"].as_str().unwrap_or("未知错误");
        return Err(format!("状态检查失败: {}", err_msg));
    }

    // 注意：status 和 appuin 在根层级，不在 data 里
    let status = result["status"].as_i64().unwrap_or(-1);

    match status {
        1 => {
            // 等待扫码
            Ok(serde_json::json!({
                "success": false,
                "scanned": false,
                "expired": false
            }))
        }
        2 => {
            // 已扫码，等待确认
            Ok(serde_json::json!({
                "success": false,
                "scanned": true,
                "expired": false
            }))
        }
        3 => {
            // 确认登录成功，打印完整的API响应和cookies
            println!("╔══════════════════════════════════════════════════════════╗");
            println!("║         小店带货助手 - 登录成功 - 完整数据              ║");
            println!("╚══════════════════════════════════════════════════════════╝");
            println!("\n【JSON 响应体】");
            println!(
                "{}",
                serde_json::to_string_pretty(&result).unwrap_or_default()
            );
            println!("\n【HTTP Cookies】");
            for (name, value) in &cookies {
                println!("  {} = {}", name, value);
            }
            println!("\n══════════════════════════════════════════════════════════\n");

            // 提取cookie
            let mut cookie_str = String::new();
            for (name, value) in cookies {
                if !cookie_str.is_empty() {
                    cookie_str.push_str("; ");
                }
                cookie_str.push_str(&format!("{}={}", name, value));
            }

            // 提取用户信息（appuin 在根层级）
            let appuin = result["appuin"].as_u64().unwrap_or(0);
            let nickname = format!("商家{}", appuin); // 使用 appuin 作为昵称

            Ok(serde_json::json!({
                "success": true,
                "scanned": true,
                "expired": false,
                "cookie": cookie_str,
                "nickname": nickname,
                "avatar": ""
            }))
        }
        4 | 5 => {
            // 二维码过期或用户取消
            Ok(serde_json::json!({
                "success": false,
                "scanned": false,
                "expired": true
            }))
        }
        _ => {
            // 未知状态
            Ok(serde_json::json!({
                "success": false,
                "scanned": false,
                "expired": false
            }))
        }
    }
}

// ==================== Cookie 验证命令 ====================

// Cookie验证结果结构
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CookieValidationResult {
    valid: bool,
    cookie_status: String, // "online" | "offline" | "checking"
    #[serde(skip_serializing_if = "Option::is_none")]
    nickname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    avatar: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    wechat_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    finder_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    appuin: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    shop_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    account_state: Option<i64>,  // 账号状态: 0=正常, 1=异常/违规
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    login_method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    need_refetch_channels_cookie: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_rate_limited: Option<bool>,
}

// Cookie对象结构
#[derive(Debug, Serialize, Deserialize)]
struct CookieItem {
    name: String,
    value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    domain: Option<String>,
}

/// 验证Cookie（统一入口）
///
/// ✅ 修复：接受 login_method 参数，不再通过Cookie名称检测
/// login_method 来自云端数据库，是权威来源
///
/// ✅ 智能降级验证：
/// - 视频号助手：本地验证（轻量级API）
/// - 带货助手：调用云端智能验证API（优先视频号Cookie，降级带货助手Cookie）
#[tauri::command]
async fn validate_cookie(browser_id: String, login_method: String) -> Result<serde_json::Value, String> {
    println!("[验证Cookie] 开始验证浏览器: {}, 登录方式: {}", browser_id, login_method);

    // ✅ 带货助手：调用云端智能验证API（支持降级策略）
    if login_method == "shop_helper" {
        println!("[验证Cookie] 带货助手账号，调用云端智能验证API");
        return validate_shop_helper_via_cloud(browser_id).await;
    }

    // 1. 获取浏览器Cookie（视频号助手本地验证）
    let cookies_result = get_browser_cookies(browser_id.clone()).await?;

    if !cookies_result.success {
        return Ok(serde_json::json!({
            "valid": false,
            "cookieStatus": "offline",
            "error": "无法获取浏览器Cookie"
        }));
    }

    let cookies_data = cookies_result.data.ok_or("Cookie数据为空")?;
    let cookies_array = cookies_data["cookies"]
        .as_array()
        .ok_or("Cookie格式错误")?;

    // 将JSON Value转换为CookieItem结构
    let cookies: Vec<CookieItem> = cookies_array
        .iter()
        .filter_map(|c| {
            Some(CookieItem {
                name: c["name"].as_str()?.to_string(),
                value: c["value"].as_str()?.to_string(),
                domain: c["domain"].as_str().map(|s| s.to_string()),
            })
        })
        .collect();

    println!("[验证Cookie] 获取到 {} 个Cookie", cookies.len());

    // 2. 视频号助手：本地验证
    let result = validate_channels_helper_cookie(&cookies, 0).await?;

    Ok(serde_json::to_value(result).unwrap())
}

/// 通过云端API验证带货助手账号（智能降级验证）
///
/// 云端会：
/// 1. 从数据库获取带货助手Cookie和视频号Cookie
/// 2. 优先使用视频号Cookie验证（轻量级API）
/// 3. 失败则降级使用带货助手Cookie验证
/// 4. 返回needRefetchChannelsCookie标志（如果需要重新获取视频号Cookie）
async fn validate_shop_helper_via_cloud(browser_id: String) -> Result<serde_json::Value, String> {
    // 从环境变量获取云端API地址
    let cloud_api_url = std::env::var("VITE_CLOUD_SERVICE_URL")
        .unwrap_or_else(|_| "https://api.quanyuge.cloud".to_string());

    // owner参数留空（云端会从数据库查询验证）
    let owner = String::from("");

    let url = format!("{}/api/validate?action=instant", cloud_api_url);

    let client = create_http_client_with_timeout(30)?;

    println!("[云端智能验证] 调用API: {}", url);

    match client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "browserId": browser_id,
            "owner": owner
        }))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();

            if !response.status().is_success() {
                println!("[云端智能验证] API返回错误: status={}", status);
                return Ok(serde_json::json!({
                    "valid": false,
                    "cookieStatus": "offline",
                    "error": format!("云端验证失败: HTTP {}", status)
                }));
            }

            let result: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("解析响应失败: {}", e))?;

            println!("[云端智能验证] API响应: {:?}", result);

            if !result["success"].as_bool().unwrap_or(false) {
                return Ok(serde_json::json!({
                    "valid": false,
                    "cookieStatus": "offline",
                    "error": result["error"].as_str().unwrap_or("云端验证失败")
                }));
            }

            // 提取验证结果
            let data = &result["data"];
            Ok(serde_json::json!({
                "valid": data["valid"].as_bool().unwrap_or(false),
                "cookieStatus": data["cookieStatus"].as_str().unwrap_or("offline"),
                "nickname": data["nickname"],
                "avatar": data["avatar"],
                "error": data["error"],
                "loginMethod": "shop_helper",
                "needRefetchChannelsCookie": data["needRefetchChannelsCookie"],
                "isRateLimited": data["isRateLimited"]
            }))
        }
        Err(e) => {
            println!("[云端智能验证] 请求失败: {}", e);
            Ok(serde_json::json!({
                "valid": false,
                "cookieStatus": "offline",
                "error": format!("网络错误: {}", e)
            }))
        }
    }
}

/// 识别登录方式
fn detect_login_method(cookies: &[CookieItem]) -> Option<String> {
    if cookies.is_empty() {
        return None;
    }

    let cookie_names: Vec<&str> = cookies.iter().map(|c| c.name.as_str()).collect();

    // 带货助手（小店助手）特征：talent_token
    if cookie_names.contains(&"talent_token") {
        return Some("shop_helper".to_string());
    }

    // 视频号助手特征：sessionid 或 wxuin
    if cookie_names.contains(&"sessionid") || cookie_names.contains(&"wxuin") {
        return Some("channels_helper".to_string());
    }

    // 默认：视频号助手
    Some("channels_helper".to_string())
}

/// 检查是否有视频号Cookie（用于带货助手账号）
fn has_channels_cookie(cookies: &[CookieItem]) -> bool {
    let cookie_names: Vec<&str> = cookies.iter().map(|c| c.name.as_str()).collect();
    cookie_names.contains(&"sessionid") || cookie_names.contains(&"wxuin")
}

/// 验证视频号助手Cookie（带重试机制）
/// 使用手机端轻量级API - 快速检测状态 + 获取账号状态信息
async fn validate_channels_helper_cookie(
    cookies: &[CookieItem],
    retry_count: u32,
) -> Result<CookieValidationResult, String> {
    const MAX_RETRIES: u32 = 3;
    const RETRY_DELAY_MS: u64 = 2000;

    // ⭐ 关键：Cookie转换 - 手机端API需要 _finder_auth
    // PC端: sessionid=xxx; wxuin=xxx
    // 手机端: _finder_auth=xxx; wxuin=xxx
    let sessionid = cookies
        .iter()
        .find(|c| c.name == "sessionid" || c.name == "_finder_auth")
        .map(|c| c.value.clone())
        .ok_or("缺少sessionid")?;

    let wxuin = cookies
        .iter()
        .find(|c| c.name == "wxuin")
        .map(|c| c.value.clone())
        .ok_or("缺少wxuin")?;

    // 构造手机端Cookie字符串
    let cookie_str = format!("_finder_auth={}; wxuin={}", sessionid, wxuin);

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string();

    let client = create_http_client_with_timeout(10)?;

    // ⭐ 使用手机端轻量级API（需要 assistant-support 前缀）
    let url = "https://channels.weixin.qq.com/assistant-support/api/finder-account-status/get-finder-acct-state";

    if retry_count > 0 {
        println!(
            "[视频号助手] 开始验证Cookie（手机端API），重试次数: {}/{}",
            retry_count, MAX_RETRIES
        );
    } else {
        println!("[视频号助手] 开始验证Cookie（手机端轻量级API）");
    }

    // 手机端API请求体（简化格式）
    let body = serde_json::json!({
        "_timestamp": timestamp
    });

    // 手机端User-Agent（iPhone）
    match client
        .post(url)
        .header("Accept", "application/json, text/plain, */*")
        .header("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148")
        .header("Content-Type", "application/json")
        .header("Accept-Language", "zh-CN,zh;q=0.9")
        .header("Cookie", &cookie_str)
        .json(&body)
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();

            // 401/403 表示Cookie无效，不重试
            if status == 401 || status == 403 {
                println!("[视频号助手] Cookie无效 (401/403)");
                return Ok(CookieValidationResult {
                    valid: false,
                    cookie_status: "offline".to_string(),
                    nickname: None,
                    avatar: None,
                    wechat_id: None,
                    finder_username: None,
                    appuin: None,
                    shop_name: None,
                    account_state: None,
                    error: Some("Cookie已过期或无效".to_string()),
                    login_method: Some("channels_helper".to_string()),
                    need_refetch_channels_cookie: None,
                    is_rate_limited: None,
                });
            }

            let result: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("解析响应失败: {}", e))?;

            println!(
                "[视频号助手] 手机端API响应: errCode={}, hasData={}",
                result["errCode"],
                result["data"].is_object()
            );

            // 手机端API响应格式：
            // { "errCode": 0, "data": { "baseResp": { "errcode": 0 }, "nickname": "...", "state": 0, ... } }

            // 1. 先检查外层errCode
            if result["errCode"].as_i64() != Some(0) {
                let err_msg = result["errMsg"].as_str().unwrap_or("未知错误");
                println!("[视频号助手] API返回错误: {}", err_msg);

                let err_code = result["errCode"].as_i64().unwrap_or(0);
                let is_rate_limited = err_code == 45009
                    || err_msg.contains("freq")
                    || err_msg.contains("limit");

                return Ok(CookieValidationResult {
                    valid: false,
                    cookie_status: "offline".to_string(),
                    nickname: None,
                    avatar: None,
                    wechat_id: None,
                    finder_username: None,
                    appuin: None,
                    shop_name: None,
                    account_state: None,
                    error: Some(err_msg.to_string()),
                    login_method: Some("channels_helper".to_string()),
                    need_refetch_channels_cookie: None,
                    is_rate_limited: Some(is_rate_limited),
                });
            }

            let response_data = &result["data"];

            // 2. 检查baseResp（Cookie认证结果）
            let base_resp = &response_data["baseResp"];
            let base_errcode = base_resp["errcode"].as_i64().unwrap_or(-1);

            if base_errcode != 0 {
                let err_msg = base_resp["errmsg"].as_str().unwrap_or("Cookie无效");
                println!("[视频号助手] Cookie认证失败: {}", err_msg);

                return Ok(CookieValidationResult {
                    valid: false,
                    cookie_status: "offline".to_string(),
                    nickname: None,
                    avatar: None,
                    wechat_id: None,
                    finder_username: None,
                    appuin: None,
                    shop_name: None,
                    account_state: None,
                    error: Some(format!("Cookie无效: {}", err_msg)),
                    login_method: Some("channels_helper".to_string()),
                    need_refetch_channels_cookie: None,
                    is_rate_limited: None,
                });
            }

            // 3. Cookie有效，提取账号信息
            let nickname = response_data["nickname"]
                .as_str()
                .unwrap_or("用户")
                .to_string();

            let avatar = response_data["headImg"]
                .as_str()
                .unwrap_or("")
                .to_string();

            let username = response_data["username"]
                .as_str()
                .unwrap_or("")
                .to_string();

            let account_state = response_data["state"].as_i64().unwrap_or(0);

            println!(
                "[视频号助手] ✓ Cookie有效: {}, 账号状态={}",
                nickname, account_state
            );

            Ok(CookieValidationResult {
                valid: true,
                cookie_status: "online".to_string(),
                nickname: Some(nickname),
                avatar: Some(avatar),
                wechat_id: None,
                finder_username: Some(username),
                appuin: None,
                shop_name: None,
                account_state: Some(account_state),  // ✅ 添加账号状态
                error: None,
                login_method: Some("channels_helper".to_string()),
                need_refetch_channels_cookie: None,
                is_rate_limited: None,
            })
        }
        Err(e) => {
            // 检查是否需要重试
            let status_code = e.status().map(|s| s.as_u16()).unwrap_or(0);

            // 401/403 表示Cookie无效，不重试
            if status_code == 401 || status_code == 403 {
                println!("[视频号助手] Cookie无效 (401/403)");
                return Ok(CookieValidationResult {
                    valid: false,
                    cookie_status: "offline".to_string(),
                    nickname: None,
                    avatar: None,
                    wechat_id: None,
                    finder_username: None,
                    appuin: None,
                    shop_name: None,
                    account_state: None,
                    error: Some("Cookie已过期或无效".to_string()),
                    login_method: Some("channels_helper".to_string()),
                    need_refetch_channels_cookie: None,
                    is_rate_limited: None,
                });
            }

            // 429限流、500/502/503/504服务器错误 - 需要重试
            let should_retry = status_code == 429
                || status_code == 500
                || status_code == 502
                || status_code == 503
                || status_code == 504
                || e.is_timeout()
                || status_code == 0;

            if should_retry && retry_count < MAX_RETRIES {
                let delay = RETRY_DELAY_MS * (retry_count as u64 + 1);
                println!(
                    "[视频号助手] API临时错误 ({}), {}ms后重试 ({}/{})",
                    status_code,
                    delay,
                    retry_count + 1,
                    MAX_RETRIES
                );
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                // 使用Box::pin来处理异步递归
                return Box::pin(validate_channels_helper_cookie(cookies, retry_count + 1)).await;
            }

            // 429 表示限流
            if status_code == 429 {
                return Ok(CookieValidationResult {
                    valid: false,
                    cookie_status: "offline".to_string(),
                    nickname: None,
                    avatar: None,
                    wechat_id: None,
                    finder_username: None,
                    appuin: None,
                    shop_name: None,
                    account_state: None,
                    error: Some("API限流".to_string()),
                    login_method: Some("channels_helper".to_string()),
                    need_refetch_channels_cookie: None,
                    is_rate_limited: Some(true),
                });
            }

            // 其他HTTP错误或重试次数用尽
            if status_code > 0 {
                println!(
                    "[视频号助手] API返回错误: status={}, retry_count={}",
                    status_code, retry_count
                );
                return Ok(CookieValidationResult {
                    valid: false,
                    cookie_status: "offline".to_string(),
                    nickname: None,
                    avatar: None,
                    wechat_id: None,
                    finder_username: None,
                    appuin: None,
                    shop_name: None,
                    account_state: None,
                    error: Some(format!("API错误({})", status_code)),
                    login_method: Some("channels_helper".to_string()),
                    need_refetch_channels_cookie: None,
                    is_rate_limited: None,
                });
            }

            // 网络错误或超时，重试次数用尽
            println!(
                "[视频号助手] 验证Cookie失败: {}, 重试次数: {}",
                e, retry_count
            );
            Ok(CookieValidationResult {
                valid: false,
                cookie_status: "offline".to_string(),
                nickname: None,
                avatar: None,
                wechat_id: None,
                finder_username: None,
                appuin: None,
                shop_name: None,
                account_state: None,
                error: Some(format!("网络错误: {}", e)),
                login_method: Some("channels_helper".to_string()),
                need_refetch_channels_cookie: None,
                is_rate_limited: None,
            })
        }
    }
}

/// 验证带货助手Cookie（带重试机制）
async fn validate_shop_helper_cookie(
    cookies: &[CookieItem],
    retry_count: u32,
) -> Result<CookieValidationResult, String> {
    const MAX_RETRIES: u32 = 3;
    const RETRY_DELAY_MS: u64 = 2000;

    let cookie_str = cookies
        .iter()
        .map(|c| format!("{}={}", c.name, c.value))
        .collect::<Vec<_>>()
        .join("; ");

    // 提取talent_magic用于请求头
    let talent_magic = cookies
        .iter()
        .find(|c| c.name == "talent_magic")
        .map(|c| c.value.clone())
        .unwrap_or_default();

    let client = create_http_client_with_timeout(10)?;

    if retry_count > 0 {
        println!(
            "[带货助手] 开始验证Cookie，重试次数: {}/{}",
            retry_count, MAX_RETRIES
        );
    } else {
        println!("[带货助手] 开始验证Cookie");
    }

    let url = "https://store.weixin.qq.com/shop-faas/mmeckolbasenode/base/getBindChannelList";

    match client
        .get(url)
        .query(&[("token", ""), ("lang", "zh_CN")])
        .header("Accept", "application/json, text/plain, */*")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .header("Cookie", &cookie_str)
        .header("Referer", "https://store.weixin.qq.com/talent/channel/finder")
        .header("talent_magic", &talent_magic)
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();

            // 401/403 表示Cookie无效，不重试
            if status == 401 || status == 403 {
                println!("[带货助手] Cookie无效 (401/403)");
                return Ok(CookieValidationResult {
                    valid: false,
                    cookie_status: "offline".to_string(),
                    nickname: None,
                    avatar: None,
                    wechat_id: None,
                    finder_username: None,
                    appuin: None,
                    shop_name: None,
                    account_state: None,
                    error: Some("Cookie已过期或无效".to_string()),
                    login_method: Some("shop_helper".to_string()),
                    need_refetch_channels_cookie: None,
                    is_rate_limited: None,
                });
            }

            let result: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("解析响应失败: {}", e))?;

            println!("[带货助手] API响应: {:?}", result);

            // 检查返回码
            if result["code"].as_i64() != Some(0) {
                let err_msg = result["msg"].as_str().unwrap_or("未知错误");
                println!("[带货助手] 验证失败: {}", err_msg);

                // 检查是否是限流错误
                let err_code = result["code"].as_i64().unwrap_or(0);
                let is_rate_limited = err_code == 45009
                    || err_msg.contains("freq")
                    || err_msg.contains("limit");

                return Ok(CookieValidationResult {
                    valid: false,
                    cookie_status: "offline".to_string(),
                    nickname: None,
                    avatar: None,
                    wechat_id: None,
                    finder_username: None,
                    appuin: None,
                    shop_name: None,
                    account_state: None,
                    error: Some(err_msg.to_string()),
                    login_method: Some("shop_helper".to_string()),
                    need_refetch_channels_cookie: None,
                    is_rate_limited: Some(is_rate_limited),
                });
            }

            // 从绑定的视频号列表中获取信息
            let finder_list = result["data"]["finderList"]
                .as_array()
                .or_else(|| result["finderList"].as_array())
                .cloned()
                .unwrap_or_default();

            println!("[带货助手] 绑定的视频号列表: {:?}", finder_list);

            // ✅ 注意：带货助手账号的视频号Cookie不存储在BitBrowser，而是存储在云端数据库
            // 因此这里不检查BitBrowser里的视频号Cookie，needRefetch由前端根据数据库判断

            if !finder_list.is_empty() {
                let finder_info = &finder_list[0];
                println!("[带货助手] 第一个视频号信息: {:?}", finder_info);

                return Ok(CookieValidationResult {
                    valid: true,
                    cookie_status: "online".to_string(),
                    nickname: finder_info["nickname"]
                        .as_str()
                        .map(|s| s.to_string())
                        .or(Some("带货用户".to_string())),
                    avatar: finder_info["headImgUrl"]
                        .as_str()
                        .map(|s| s.to_string()),
                    wechat_id: None,
                    finder_username: finder_info["finderUsername"]
                        .as_str()
                        .map(|s| s.to_string()),
                    appuin: finder_info["finderUniqId"]
                        .as_str()
                        .or(finder_info["finderUsername"].as_str())
                        .map(|s| s.to_string()),
                    shop_name: None,
                    account_state: None,
                    error: None,
                    login_method: Some("shop_helper".to_string()),
                    need_refetch_channels_cookie: None,  // ✅ 由前端根据数据库判断
                    is_rate_limited: None,
                });
            }

            // 如果没有绑定视频号，Cookie仍然有效，但没有视频号信息
            println!("[带货助手] 未绑定视频号，但Cookie有效");
            Ok(CookieValidationResult {
                valid: true,
                cookie_status: "online".to_string(),
                nickname: Some("暂未绑定视频号".to_string()),
                avatar: None,
                wechat_id: None,
                finder_username: Some("".to_string()),
                appuin: Some("".to_string()),
                shop_name: None,
                account_state: None,
                error: None,
                login_method: Some("shop_helper".to_string()),
                need_refetch_channels_cookie: None,  // ✅ 由前端根据数据库判断
                is_rate_limited: None,
            })
        }
        Err(e) => {
            // 检查是否需要重试
            let status_code = e.status().map(|s| s.as_u16()).unwrap_or(0);

            // 401/403 表示Cookie无效，不重试
            if status_code == 401 || status_code == 403 {
                println!("[带货助手] Cookie无效 (401/403)");
                return Ok(CookieValidationResult {
                    valid: false,
                    cookie_status: "offline".to_string(),
                    nickname: None,
                    avatar: None,
                    wechat_id: None,
                    finder_username: None,
                    appuin: None,
                    shop_name: None,
                    account_state: None,
                    error: Some("Cookie已过期或无效".to_string()),
                    login_method: Some("shop_helper".to_string()),
                    need_refetch_channels_cookie: None,
                    is_rate_limited: None,
                });
            }

            // 429限流、500/502/503/504服务器错误 - 需要重试
            let should_retry = status_code == 429
                || status_code == 500
                || status_code == 502
                || status_code == 503
                || status_code == 504
                || e.is_timeout()
                || status_code == 0;

            if should_retry && retry_count < MAX_RETRIES {
                let delay = RETRY_DELAY_MS * (retry_count as u64 + 1);
                println!(
                    "[带货助手] API临时错误 ({}), {}ms后重试 ({}/{})",
                    status_code,
                    delay,
                    retry_count + 1,
                    MAX_RETRIES
                );
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                // 使用Box::pin来处理异步递归
                return Box::pin(validate_shop_helper_cookie(cookies, retry_count + 1)).await;
            }

            // 429 表示限流
            if status_code == 429 {
                return Ok(CookieValidationResult {
                    valid: false,
                    cookie_status: "offline".to_string(),
                    nickname: None,
                    avatar: None,
                    wechat_id: None,
                    finder_username: None,
                    appuin: None,
                    shop_name: None,
                    account_state: None,
                    error: Some("API限流".to_string()),
                    login_method: Some("shop_helper".to_string()),
                    need_refetch_channels_cookie: None,
                    is_rate_limited: Some(true),
                });
            }

            // 其他HTTP错误或重试次数用尽
            if status_code > 0 {
                println!(
                    "[带货助手] API返回错误: status={}, retry_count={}",
                    status_code, retry_count
                );
                return Ok(CookieValidationResult {
                    valid: false,
                    cookie_status: "offline".to_string(),
                    nickname: None,
                    avatar: None,
                    wechat_id: None,
                    finder_username: None,
                    appuin: None,
                    shop_name: None,
                    account_state: None,
                    error: Some(format!("API错误({})", status_code)),
                    login_method: Some("shop_helper".to_string()),
                    need_refetch_channels_cookie: None,
                    is_rate_limited: None,
                });
            }

            // 网络错误或超时，重试次数用尽
            println!(
                "[带货助手] 验证Cookie失败: {}, 重试次数: {}",
                e, retry_count
            );
            Ok(CookieValidationResult {
                valid: false,
                cookie_status: "offline".to_string(),
                nickname: None,
                avatar: None,
                wechat_id: None,
                finder_username: None,
                appuin: None,
                shop_name: None,
                account_state: None,
                error: Some(format!("网络错误: {}", e)),
                login_method: Some("shop_helper".to_string()),
                need_refetch_channels_cookie: None,
                is_rate_limited: None,
            })
        }
    }
}

// 获取下一个浏览器序号
async fn get_next_browser_seq(client: &reqwest::Client) -> Result<i64, String> {
    let base_url = get_bb_api_url().await?;
    // 获取浏览器列表
    let response = client
        .post(format!("{}/browser/list", base_url))
        .json(&serde_json::json!({
            "page": 0,
            "pageSize": 1000  // 获取所有浏览器以确定最大序号
        }))
        .send()
        .await
        .map_err(|e| format!("获取浏览器列表失败: {}", e))?;

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if result["success"].as_bool().unwrap_or(false) {
        // 查找最大的 seq 值
        let mut max_seq = 0i64;
        if let Some(list) = result["data"]["list"].as_array() {
            for browser in list {
                if let Some(seq) = browser["seq"].as_i64() {
                    if seq > max_seq {
                        max_seq = seq;
                    }
                }
            }
        }
        Ok(max_seq + 1)
    } else {
        // 如果获取失败，返回一个较大的默认值
        Ok(999)
    }
}

// 创建浏览器
#[tauri::command]
async fn create_browser_with_account(
    config: serde_json::Value,
    cookie: String,
    nickname: Option<String>,
    _app: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    let client = create_http_client();

    // 如果没有提供 nickname，获取下一个序号
    let browser_name = if let Some(name) = nickname {
        name
    } else {
        // 获取下一个序号
        match get_next_browser_seq(&client).await {
            Ok(seq) => format!("#{}", seq),
            Err(e) => {
                println!("[创建浏览器] 获取序号失败: {}, 使用默认名称", e);
                "新账号".to_string()
            }
        }
    };

    let mut params = serde_json::json!({
        "name": browser_name,
        "remark": config["remark"].as_str().unwrap_or(""),
        "browserFingerPrint": {},
        "url": "",
        "memorySaver": true,
        "syncTabs": false
    });

    // 设置分组
    if let Some(group_id) = config["groupId"].as_str() {
        params["groupId"] = serde_json::json!(group_id);
    }

    // 解析cookie字符串为cookie数组
    let cookie_array: Vec<serde_json::Value> = cookie
        .split("; ")
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let name = parts.next()?;
            let value = parts.next()?;
            Some(serde_json::json!({
                "name": name,
                "value": value,
                "domain": ".weixin.qq.com"
            }))
        })
        .collect();

    params["cookie"] = serde_json::json!(cookie_array);

    // 配置代理
    if config["proxy"].is_object() {
        // TODO: 处理代理配置
        params["proxyMethod"] = serde_json::json!(2);
        params["proxyType"] = serde_json::json!("noproxy");
    } else {
        params["proxyMethod"] = serde_json::json!(2);
        params["proxyType"] = serde_json::json!("noproxy");
    }

    // 注意：插件通过 open_browser 的 --load-extension 参数动态加载，无需在创建时配置

    let base_url = get_bb_api_url().await?;
    let response = client
        .post(format!("{}/browser/update", base_url))
        .json(&params)
        .send()
        .await
        .map_err(|e| format!("创建浏览器失败: {}", e))?;

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if result["success"].as_bool().unwrap_or(false) {
        let browser_id = result["data"]["id"].as_str().unwrap_or("");
        Ok(serde_json::json!({
            "success": true,
            "browserId": browser_id
        }))
    } else {
        let msg = result["msg"].as_str().unwrap_or("创建失败");
        Ok(serde_json::json!({
            "success": false,
            "message": msg
        }))
    }
}

// 同步Cookie到浏览器（用于链接登录）
#[tauri::command]
async fn sync_cookie_to_browser(browser_id: String, cookie: String) -> Result<ApiResponse, String> {
    let client = create_http_client();

    println!("[同步Cookie] 浏览器ID: {}", browser_id);

    let base_url = get_bb_api_url().await?;

    // 1. 获取浏览器详情
    let detail_response = client
        .post(format!("{}/browser/detail", base_url))
        .json(&serde_json::json!({
            "id": browser_id
        }))
        .send()
        .await
        .map_err(|e| format!("获取浏览器详情失败: {}", e))?;

    if !detail_response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "获取浏览器详情失败".to_string(),
            data: None,
        });
    }

    let browser_detail: serde_json::Value = detail_response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if !browser_detail["success"].as_bool().unwrap_or(false) {
        return Ok(ApiResponse {
            success: false,
            message: browser_detail["msg"]
                .as_str()
                .unwrap_or("获取浏览器详情失败")
                .to_string(),
            data: None,
        });
    }

    // 2. 提取现有配置
    let mut update_params = browser_detail["data"].clone();

    // 3. 解析并更新 Cookie（只更新 Cookie，不修改其他配置）
    let cookie_array: Vec<serde_json::Value> = cookie
        .split("; ")
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let name = parts.next()?;
            let value = parts.next()?;
            Some(serde_json::json!({
                "name": name,
                "value": value,
                "domain": ".weixin.qq.com"
            }))
        })
        .collect();

    update_params["cookie"] = serde_json::json!(cookie_array);

    println!(
        "[同步Cookie] 准备更新浏览器，Cookie数量: {}",
        cookie_array.len()
    );

    // 5. 调用 BitBrowser API 更新
    let response = client
        .post(format!("{}/browser/update", base_url))
        .json(&update_params)
        .send()
        .await
        .map_err(|e| format!("同步Cookie失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "同步Cookie失败".to_string(),
            data: None,
        });
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if result["success"].as_bool().unwrap_or(false) {
        println!("[同步Cookie] ✅ Cookie同步成功: {}", browser_id);
        Ok(ApiResponse {
            success: true,
            message: "Cookie同步成功".to_string(),
            data: None,
        })
    } else {
        let msg = result["msg"].as_str().unwrap_or("同步失败");
        println!("[同步Cookie] ❌ Cookie同步失败: {}", msg);
        Ok(ApiResponse {
            success: false,
            message: msg.to_string(),
            data: None,
        })
    }
}

// ==================== 账号管理命令 ====================

// 获取分组列表
#[tauri::command]
async fn get_group_list() -> Result<ApiResponse, String> {
    let base_url = get_bb_api_url().await?;
    let client = create_http_client();

    let response = client
        .post(format!("{}/group/list", base_url))
        .json(&serde_json::json!({
            "page": 0,
            "pageSize": 100
        }))
        .send()
        .await
        .map_err(|e| format!("API调用失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "获取分组列表失败".to_string(),
            data: None,
        });
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(ApiResponse {
        success: result["success"].as_bool().unwrap_or(false),
        message: "获取分组列表成功".to_string(),
        data: result.get("data").cloned(),
    })
}

// 获取浏览器列表
#[tauri::command]
async fn get_browser_list(
    page: Option<i32>,
    page_size: Option<i32>,
    created_name: Option<String>,
) -> Result<ApiResponse, String> {
    let base_url = get_bb_api_url().await?;
    let client = create_http_client();

    let response = client
        .post(format!("{}/browser/list", base_url))
        .json(&serde_json::json!({
            "page": page.unwrap_or(0),
            "pageSize": page_size.unwrap_or(100)
        }))
        .send()
        .await
        .map_err(|e| format!("API调用失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "获取浏览器列表失败".to_string(),
            data: None,
        });
    }

    let mut result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    // 如果指定了 created_name，在后端进行筛选
    if let Some(filter_name) = created_name {
        if let Some(data) = result.get_mut("data") {
            // 先筛选浏览器列表
            let filtered_count = if let Some(list) = data.get_mut("list") {
                if let Some(browsers) = list.as_array_mut() {
                    // 筛选出 createdName 匹配的浏览器
                    browsers.retain(|browser| {
                        browser
                            .get("createdName")
                            .and_then(|v| v.as_str())
                            .map(|name| name == filter_name)
                            .unwrap_or(false)
                    });
                    Some(browsers.len())
                } else {
                    None
                }
            } else {
                None
            };

            // 更新 total 计数
            if let Some(count) = filtered_count {
                if let Some(total_field) = data.as_object_mut() {
                    total_field.insert("total".to_string(), serde_json::json!(count));
                }
            }
        }
    }

    Ok(ApiResponse {
        success: result["success"].as_bool().unwrap_or(false),
        message: "获取浏览器列表成功".to_string(),
        data: result.get("data").cloned(),
    })
}

// 打开浏览器
#[tauri::command]
async fn open_browser(
    browser_id: String,
    args: Option<Vec<String>>,
    load_url: Option<String>,
    clear_cookies: Option<bool>,
    app: tauri::AppHandle,
) -> Result<ApiResponse, String> {
    let base_url = get_bb_api_url().await?;
    let client = create_http_client();

    let mut payload = serde_json::json!({
        "id": browser_id,
        "loadExtensions": true  // 加载扩展中心已启用的扩展
    });

    // 构建 args 数组：添加扩展路径 + 启动 URL
    let mut args_vec = args.unwrap_or(vec![]);

    // 🔧 Chrome v137+ 需要添加此参数以重新启用 --load-extension 功能
    args_vec.push("--disable-features=DisableLoadExtensionCommandLineSwitch".to_string());

    // 🎯 添加扩展加载参数（使用 --load-extension）
    match get_plugin_path(app) {
        Ok(plugin_path) => {
            println!("[open_browser] 添加扩展加载参数: {}", plugin_path);
            args_vec.push(format!("--load-extension={}", plugin_path));
        }
        Err(e) => {
            println!("[open_browser] 获取插件路径失败: {}, 跳过扩展加载", e);
        }
    }

    // 添加启动 URL
    if let Some(url) = load_url {
        println!("[open_browser] 添加启动URL到args: {}", url);
        args_vec.push(url);
    }

    // 只有在 args 不为空时才添加到 payload
    if !args_vec.is_empty() {
        payload["args"] = serde_json::json!(args_vec);
    }

    if let Some(clear) = clear_cookies {
        payload["clearCacheFilesBeforeLaunch"] = serde_json::json!(clear);
    }

    println!(
        "[open_browser] 请求payload: {}",
        serde_json::to_string_pretty(&payload).unwrap_or_default()
    );

    let response = client
        .post(format!("{}/browser/open", base_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("API调用失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "打开浏览器失败".to_string(),
            data: None,
        });
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(ApiResponse {
        success: result["success"].as_bool().unwrap_or(false),
        message: "浏览器已启动".to_string(),
        data: result.get("data").cloned(),
    })
}

// 关闭浏览器
#[tauri::command]
async fn close_browser(browser_id: String) -> Result<ApiResponse, String> {
    let base_url = get_bb_api_url().await?;
    let client = create_http_client();

    let response = client
        .post(format!("{}/browser/close", base_url))
        .json(&serde_json::json!({
            "id": browser_id
        }))
        .send()
        .await
        .map_err(|e| format!("API调用失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "关闭浏览器失败".to_string(),
            data: None,
        });
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(ApiResponse {
        success: result["success"].as_bool().unwrap_or(false),
        message: "浏览器已关闭".to_string(),
        data: None,
    })
}

// 删除浏览器
#[tauri::command]
async fn delete_browser(browser_id: String) -> Result<ApiResponse, String> {
    let base_url = get_bb_api_url().await?;
    let client = create_http_client();

    let response = client
        .post(format!("{}/browser/delete", base_url))
        .json(&serde_json::json!({
            "id": browser_id
        }))
        .send()
        .await
        .map_err(|e| format!("API调用失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "删除浏览器失败".to_string(),
            data: None,
        });
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(ApiResponse {
        success: result["success"].as_bool().unwrap_or(false),
        message: "浏览器已删除".to_string(),
        data: None,
    })
}

// 更新浏览器名称（由 Realtime 服务调用）
#[tauri::command]
async fn update_browser_name(browser_id: String, name: String) -> Result<ApiResponse, String> {
    let base_url = get_bb_api_url().await?;
    let client = create_http_client();

    println!(
        "[更新浏览器名称] 浏览器ID: {}, 新名称: {}",
        browser_id, name
    );

    // 1. 获取浏览器详情
    let detail_response = client
        .post(format!("{}/browser/detail", base_url))
        .json(&serde_json::json!({
            "id": browser_id
        }))
        .send()
        .await
        .map_err(|e| format!("获取浏览器详情失败: {}", e))?;

    if !detail_response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "获取浏览器详情失败".to_string(),
            data: None,
        });
    }

    let browser_detail: serde_json::Value = detail_response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if !browser_detail["success"].as_bool().unwrap_or(false) {
        return Ok(ApiResponse {
            success: false,
            message: browser_detail["msg"]
                .as_str()
                .unwrap_or("获取浏览器详情失败")
                .to_string(),
            data: None,
        });
    }

    // 2. 只更新名称
    let mut update_params = browser_detail["data"].clone();
    update_params["name"] = serde_json::json!(name);

    // 3. 调用 BitBrowser API 更新
    let response = client
        .post(format!("{}/browser/update", base_url))
        .json(&update_params)
        .send()
        .await
        .map_err(|e| format!("更新浏览器名称失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "更新浏览器名称失败".to_string(),
            data: None,
        });
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if result["success"].as_bool().unwrap_or(false) {
        println!(
            "[更新浏览器名称] ✅ 名称更新成功: {} -> {}",
            browser_id, name
        );
        Ok(ApiResponse {
            success: true,
            message: "浏览器名称已更新".to_string(),
            data: None,
        })
    } else {
        let msg = result["msg"].as_str().unwrap_or("更新失败");
        println!("[更新浏览器名称] ❌ 名称更新失败: {}", msg);
        Ok(ApiResponse {
            success: false,
            message: msg.to_string(),
            data: None,
        })
    }
}

// 获取浏览器Cookie
#[tauri::command]
async fn get_browser_cookies(browser_id: String) -> Result<ApiResponse, String> {
    let base_url = get_bb_api_url().await?;
    let client = create_http_client();

    // 调用 browser/detail 获取浏览器详情
    let response = client
        .post(format!("{}/browser/detail", base_url))
        .json(&serde_json::json!({
            "id": browser_id
        }))
        .send()
        .await
        .map_err(|e| format!("API调用失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "获取浏览器详情失败".to_string(),
            data: None,
        });
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if !result["success"].as_bool().unwrap_or(false) {
        return Ok(ApiResponse {
            success: false,
            message: result["msg"]
                .as_str()
                .unwrap_or("获取浏览器详情失败")
                .to_string(),
            data: None,
        });
    }

    // 提取 cookie 字段（这是一个 JSON 字符串，不是数组）
    let cookie_str = result["data"]["cookie"].as_str().unwrap_or("");

    // 如果 cookie 字段为空或空字符串，返回空数组
    let cookies = if cookie_str.is_empty() {
        serde_json::Value::Array(vec![])
    } else {
        // 解析 JSON 字符串为数组
        match serde_json::from_str::<serde_json::Value>(cookie_str) {
            Ok(parsed) => parsed,
            Err(e) => {
                println!("[get_browser_cookies] 解析Cookie JSON失败: {}", e);
                serde_json::Value::Array(vec![])
            }
        }
    };

    Ok(ApiResponse {
        success: true,
        message: "获取Cookie成功".to_string(),
        data: Some(serde_json::json!({
            "cookies": cookies
        })),
    })
}

// ==================== 插件管理命令 ====================

/// 同步插件文件从 resources 到 exe 同目录（用于热更新后更新插件）
fn sync_plugin_from_resources(app: &tauri::AppHandle) -> Result<(), String> {
    use std::fs;

    // 获取 resource_dir (热更新会更新这里的文件)
    let resource_dir = app
        .path_resolver()
        .resource_dir()
        .ok_or("无法获取资源目录")?;

    let source_plugin = resource_dir.join("resources").join("browser-extension");

    // 获取 exe 同目录
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe_path.parent().ok_or("无法获取exe目录")?;
    let target_plugin = exe_dir.join("browser-extension");

    // 检查源插件是否存在
    if !source_plugin.exists() {
        return Err("资源目录中未找到插件".to_string());
    }

    // 检查是否需要更新：比较 manifest.json 的修改时间
    let source_manifest = source_plugin.join("manifest.json");
    let target_manifest = target_plugin.join("manifest.json");

    let need_update = if target_manifest.exists() {
        // 比较文件修改时间
        let source_time = fs::metadata(&source_manifest)
            .and_then(|m| m.modified())
            .ok();
        let target_time = fs::metadata(&target_manifest)
            .and_then(|m| m.modified())
            .ok();

        match (source_time, target_time) {
            (Some(src), Some(tgt)) => src > tgt,
            _ => true, // 无法获取时间，强制更新
        }
    } else {
        true // 目标不存在，需要复制
    };

    if need_update {
        println!("[插件同步] 检测到插件更新，正在同步到 exe 目录...");

        // 删除旧的插件目录
        if target_plugin.exists() {
            fs::remove_dir_all(&target_plugin).map_err(|e| {
                format!("删除旧插件失败: {}", e)
            })?;
        }

        // 复制新插件
        copy_dir_all(&source_plugin, &target_plugin).map_err(|e| {
            format!("复制插件失败: {}", e)
        })?;

        println!("[插件同步] ✅ 插件同步成功: {}", target_plugin.display());
    } else {
        println!("[插件同步] 插件已是最新版本");
    }

    Ok(())
}

/// 递归复制目录
fn copy_dir_all(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    use std::fs;

    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dst_path = dst.join(entry.file_name());

        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst_path)?;
        } else {
            fs::copy(entry.path(), dst_path)?;
        }
    }
    Ok(())
}

// 获取插件路径
#[tauri::command]
fn get_plugin_path(
    #[allow(unused_variables)]  // app只在生产环境使用
    app: tauri::AppHandle
) -> Result<String, String> {
    // 统一从 exe 同目录下的 browser-extension 文件夹获取
    // 开发环境：target/debug/browser-extension
    // 生产环境：C:\Program Files\视频号工具箱\browser-extension

    // 首先尝试同步插件（生产环境）
    #[cfg(not(debug_assertions))]
    {
        if let Err(e) = sync_plugin_from_resources(&app) {
            println!("[插件同步] 警告: {}", e);
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let plugin_path = exe_dir.join("browser-extension");

            if plugin_path.exists() {
                let path_str = plugin_path
                    .to_str()
                    .ok_or("路径包含无效字符")?
                    .to_string();

                #[cfg(debug_assertions)]
                println!("[插件管理] 开发环境插件路径: {}", path_str);

                #[cfg(not(debug_assertions))]
                println!("[插件管理] 生产环境插件路径: {}", path_str);

                return Ok(path_str);
            } else {
                let error_msg = format!("exe同目录下未找到插件: {}", plugin_path.display());
                println!("[插件管理] 错误: {}", error_msg);
                return Err(error_msg);
            }
        }
    }

    Err("无法获取exe路径".to_string())
}

// 获取浏览器详情
#[tauri::command]
async fn get_browser_detail(browser_id: String) -> Result<ApiResponse, String> {
    let base_url = get_bb_api_url().await?;
    let client = create_http_client();

    let response = client
        .post(format!("{}/browser/detail", base_url))
        .json(&serde_json::json!({
            "id": browser_id
        }))
        .send()
        .await
        .map_err(|e| format!("API调用失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "获取浏览器详情失败".to_string(),
            data: None,
        });
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(ApiResponse {
        success: result["success"].as_bool().unwrap_or(false),
        message: result["msg"].as_str().unwrap_or("").to_string(),
        data: result.get("data").cloned(),
    })
}

// 更新浏览器配置
#[tauri::command]
async fn update_browser(browser_id: String, config: serde_json::Value) -> Result<ApiResponse, String> {
    let base_url = get_bb_api_url().await?;
    let client = create_http_client();

    let mut update_params = config;
    update_params["id"] = serde_json::json!(browser_id);

    // 🔍 调试：打印发送的配置
    println!("[update_browser] 发送的配置:");
    println!("  browser_id: {}", browser_id);
    println!("  extensions: {:?}", update_params.get("extensions"));

    let response = client
        .post(format!("{}/browser/update", base_url))
        .json(&update_params)
        .send()
        .await
        .map_err(|e| format!("API调用失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(ApiResponse {
            success: false,
            message: "更新浏览器配置失败".to_string(),
            data: None,
        });
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    // 🔍 调试：打印返回结果
    println!("[update_browser] BitBrowser 返回:");
    println!("  success: {}", result["success"].as_bool().unwrap_or(false));
    println!("  message: {}", result["msg"].as_str().unwrap_or(""));
    if let Some(data) = result.get("data") {
        println!("  data.extensions: {:?}", data.get("extensions"));
    }

    Ok(ApiResponse {
        success: result["success"].as_bool().unwrap_or(false),
        message: result["msg"].as_str().unwrap_or("").to_string(),
        data: result.get("data").cloned(),
    })
}

fn main() {
    tauri::Builder::default()
        // 初始化应用状态
        .manage(AppState {
            browser_list: Mutex::new(Vec::new()),
            checking_cookies: Mutex::new(HashSet::new()),
            bitbrowser_connected: Mutex::new(false),
            monitor_running: Arc::new(AtomicBool::new(true)),
        })
        // 初始化登录状态
        .manage(LoginState {
            tokens: Mutex::new(HashMap::new()),
            shop_tickets: Mutex::new(HashMap::new()),
        })
        // 初始化配置管理器
        .manage(config_manager::ConfigManager::new())
        // 注册Store插件
        .plugin(tauri_plugin_store::Builder::default().build())
        // 启动后台监控任务
        .setup(|app| {
            let app_handle = app.handle();
            let state = app.state::<AppState>();
            let monitor_running = state.monitor_running.clone();

            // 启动后台监控任务
            tauri::async_runtime::spawn(async move {
                bitbrowser_monitor::start_monitor(app_handle, monitor_running).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_bitbrowser_status,
            check_bitbrowser_running,
            open_bitbrowser,
            call_python_script,
            get_cached_browser_list,
            update_browser_cache,
            is_cookie_checking,
            add_checking_cookie,
            remove_checking_cookie,
            get_bitbrowser_status,
            update_bitbrowser_status,
            // BitBrowser 管理命令
            find_bitbrowser,
            get_bitbrowser_info,
            launch_bitbrowser,
            stop_bitbrowser,
            clear_bitbrowser_cache,
            kill_process_by_pid,
            // 微信登录命令
            generate_login_qr,
            check_qr_status,
            create_browser_with_account,
            sync_cookie_to_browser,
            validate_cookie,
            // 账号管理命令
            get_group_list,
            get_browser_list,
            open_browser,
            close_browser,
            delete_browser,
            get_browser_cookies,
            update_browser_name,
            get_browser_detail,
            update_browser,
            // 插件管理命令
            get_plugin_path,
            // 配置管理命令
            config_manager::config_get_string,
            config_manager::config_set_string,
            config_manager::config_get_bool,
            config_manager::config_set_bool,
            config_manager::config_get_all_accounts,
            config_manager::config_get_account,
            config_manager::config_save_account,
            config_manager::config_delete_account,
            config_manager::config_delete_accounts // BitBrowser Sidecar Commands - 临时注释
                                                   // bitbrowser_sidecar::bb_check_connection,
                                                   // bitbrowser_sidecar::bb_get_browser_list,
                                                   // bitbrowser_sidecar::bb_get_browser_detail,
                                                   // bitbrowser_sidecar::bb_open_browser,
                                                   // bitbrowser_sidecar::bb_close_browser,
                                                   // bitbrowser_sidecar::bb_delete_browsers,
                                                   // bitbrowser_sidecar::bb_create_browser,
                                                   // bitbrowser_sidecar::bb_update_browser,
                                                   // bitbrowser_sidecar::bb_sync_cookies,
                                                   // bitbrowser_sidecar::bb_batch_open_browsers,
                                                   // bitbrowser_sidecar::bb_batch_close_browsers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
