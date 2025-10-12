/**
 * BitBrowser Sidecar 调用封装
 * 提供便捷的方法调用 bitbrowser-api sidecar
 */
use serde_json::Value;
use tauri::api::process::{Command, CommandEvent};

/// Sidecar 调用结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SidecarResult {
    pub success: bool,
    pub message: String,
    pub data: Option<Value>,
}

/// 执行 Sidecar 命令并返回 JSON 结果
async fn execute_sidecar(args: Vec<&str>) -> Result<SidecarResult, String> {
    let (mut rx, _child) = Command::new_sidecar("bitbrowser-api")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    let mut output = String::new();

    // 收集所有标准输出
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                output.push_str(&line);
            }
            CommandEvent::Stderr(line) => {
                eprintln!("Sidecar stderr: {}", line);
            }
            CommandEvent::Error(err) => {
                return Err(format!("Sidecar error: {}", err));
            }
            _ => {}
        }
    }

    // 解析 JSON 输出
    serde_json::from_str::<SidecarResult>(&output)
        .map_err(|e| format!("Failed to parse sidecar output: {}. Output: {}", e, output))
}

/// 执行需要 JSON 参数的 Sidecar 命令
async fn execute_sidecar_with_json(action: &str, params: Value) -> Result<SidecarResult, String> {
    let params_str = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    let (mut rx, mut child) = Command::new_sidecar("bitbrowser-api")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args(&[action])
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    // 写入参数到 stdin
    child
        .write(params_str.as_bytes())
        .map_err(|e| format!("Failed to write to sidecar stdin: {}", e))?;

    let mut output = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                output.push_str(&line);
            }
            CommandEvent::Stderr(line) => {
                eprintln!("Sidecar stderr: {}", line);
            }
            CommandEvent::Error(err) => {
                return Err(format!("Sidecar error: {}", err));
            }
            _ => {}
        }
    }

    serde_json::from_str::<SidecarResult>(&output)
        .map_err(|e| format!("Failed to parse sidecar output: {}. Output: {}", e, output))
}

// ========== Tauri Commands ==========

/// 检查比特浏览器连接状态
#[tauri::command]
pub async fn bb_check_connection() -> Result<SidecarResult, String> {
    execute_sidecar(vec!["check"]).await
}

/// 获取浏览器列表
#[tauri::command]
pub async fn bb_get_browser_list() -> Result<SidecarResult, String> {
    execute_sidecar(vec!["list"]).await
}

/// 获取浏览器详情
#[tauri::command]
pub async fn bb_get_browser_detail(browser_id: String) -> Result<SidecarResult, String> {
    execute_sidecar(vec!["detail", &browser_id]).await
}

/// 打开浏览器
#[tauri::command]
pub async fn bb_open_browser(browser_id: String) -> Result<SidecarResult, String> {
    execute_sidecar(vec!["open", &browser_id]).await
}

/// 关闭浏览器
#[tauri::command]
pub async fn bb_close_browser(browser_id: String) -> Result<SidecarResult, String> {
    execute_sidecar(vec!["close", &browser_id]).await
}

/// 删除浏览器（支持批量，逗号分隔）
#[tauri::command]
pub async fn bb_delete_browsers(browser_ids: String) -> Result<SidecarResult, String> {
    execute_sidecar(vec!["delete", &browser_ids]).await
}

/// 创建浏览器
#[tauri::command]
pub async fn bb_create_browser(params: Value) -> Result<SidecarResult, String> {
    execute_sidecar_with_json("create", params).await
}

/// 更新浏览器
#[tauri::command]
pub async fn bb_update_browser(params: Value) -> Result<SidecarResult, String> {
    execute_sidecar_with_json("update", params).await
}

/// 同步 Cookie
#[tauri::command]
pub async fn bb_sync_cookies(params: Value) -> Result<SidecarResult, String> {
    execute_sidecar_with_json("sync_cookies", params).await
}

// ========== 辅助函数 ==========

/// 批量打开浏览器
#[tauri::command]
pub async fn bb_batch_open_browsers(browser_ids: Vec<String>) -> Result<Vec<SidecarResult>, String> {
    let mut results = Vec::new();

    for browser_id in browser_ids {
        match bb_open_browser(browser_id.clone()).await {
            Ok(result) => results.push(result),
            Err(e) => {
                results.push(SidecarResult {
                    success: false,
                    message: format!("Failed to open browser {}: {}", browser_id, e),
                    data: None,
                });
            }
        }
    }

    Ok(results)
}

/// 批量关闭浏览器
#[tauri::command]
pub async fn bb_batch_close_browsers(browser_ids: Vec<String>) -> Result<Vec<SidecarResult>, String> {
    let mut results = Vec::new();

    for browser_id in browser_ids {
        match bb_close_browser(browser_id.clone()).await {
            Ok(result) => results.push(result),
            Err(e) => {
                results.push(SidecarResult {
                    success: false,
                    message: format!("Failed to close browser {}: {}", browser_id, e),
                    data: None,
                });
            }
        }
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_sidecar_connection() {
        // 这个测试需要比特浏览器运行
        let result = bb_check_connection().await;
        assert!(result.is_ok());
    }
}
