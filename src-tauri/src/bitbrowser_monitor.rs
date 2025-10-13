/**
 * BitBrowser Monitor
 * 负责后台监控 BitBrowser 连接状态
 *
 * 功能：
 * - 定期检测连接状态
 * - 向前端推送状态变化事件
 */
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;

use crate::bitbrowser_detector::{check_status, ConnectionStatus, DisconnectReason};

/// 监控间隔（秒）
const MONITOR_INTERVAL_SECS: u64 = 10;

/// 前端事件名称
const EVENT_NAME: &str = "bitbrowser-status";

/// 前端事件 Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusEvent {
    pub connected: bool,
    pub message: String,
    pub timestamp: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<DisconnectReason>,
}

/// 启动后台监控任务
///
/// # 参数
/// - `app_handle`: Tauri 应用句柄
/// - `running`: 控制监控任务运行的原子布尔值
pub async fn start_monitor(app_handle: tauri::AppHandle, running: Arc<AtomicBool>) {
    println!("✓ BitBrowser 后台监控任务已启动");

    // 立即执行第一次检测（代理问题已修复，无需等待）
    check_and_emit(&app_handle).await;

    // 定期检测循环
    while running.load(Ordering::Relaxed) {
        // 等待指定间隔
        tokio::time::sleep(Duration::from_secs(MONITOR_INTERVAL_SECS)).await;

        // 如果已停止，退出循环
        if !running.load(Ordering::Relaxed) {
            break;
        }

        // 执行检测并推送事件
        check_and_emit(&app_handle).await;
    }

    println!("✓ BitBrowser 后台监控任务已停止");
}

/// 上次的连接状态（用于检测状态变化）
static LAST_CONNECTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// 执行检测并向前端推送事件
async fn check_and_emit(app_handle: &tauri::AppHandle) {
    // 检测连接状态
    let status = check_status().await;

    // 构造事件 payload
    let event = match status {
        ConnectionStatus::Connected { message } => StatusEvent {
            connected: true,
            message,
            timestamp: get_timestamp(),
            reason: None,
        },
        ConnectionStatus::Disconnected { message, reason } => StatusEvent {
            connected: false,
            message,
            timestamp: get_timestamp(),
            reason: Some(reason),
        },
    };

    // 检查状态是否变化
    let last_connected = LAST_CONNECTED.load(std::sync::atomic::Ordering::Relaxed);
    let status_changed = last_connected != event.connected;

    // 更新状态
    LAST_CONNECTED.store(event.connected, std::sync::atomic::Ordering::Relaxed);

    // 推送到前端
    if let Err(e) = app_handle.emit_all(EVENT_NAME, &event) {
        eprintln!("⚠ 推送状态事件失败: {}", e);
    } else if status_changed {
        // 只在状态变化时输出日志
        println!("✓ 连接状态变化: {} -> {}",
            if last_connected { "已连接" } else { "未连接" },
            if event.connected { "已连接" } else { "未连接" }
        );
    }
}

/// 获取当前时间戳（毫秒）
fn get_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_timestamp() {
        let ts = get_timestamp();
        assert!(ts > 0);
        println!("当前时间戳: {}", ts);
    }
}
