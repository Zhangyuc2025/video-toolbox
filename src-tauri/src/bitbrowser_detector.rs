/**
 * BitBrowser Detector
 * 负责检测 BitBrowser 的连接状态
 *
 * 核心逻辑：
 * - 端口连接成功 = BitBrowser 已启动并可用
 * - 端口连接失败 = 要么未启动，要么端口被占用
 */
use serde::{Deserialize, Serialize};
use sysinfo::System;

use crate::bitbrowser_manager::{
    is_bitbrowser_process,
    is_bitbrowser_running,
    find_process_using_port
};

/// BitBrowser API 默认端口
const API_PORT: u16 = 54345;

/// BitBrowser API 基础 URL
const API_BASE_URL: &str = "http://127.0.0.1:54345";

/// 连接状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum ConnectionStatus {
    Connected {
        message: String,
    },
    Disconnected {
        reason: DisconnectReason,
        message: String,
    },
}

/// 断连原因
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
pub enum DisconnectReason {
    /// BitBrowser 进程未运行
    NotRunning,

    /// 端口被其他进程占用
    PortOccupied {
        process_name: String,
        process_id: u32,
    },

    /// BitBrowser 正在初始化（进程已启动但 API 尚未就绪）
    Initializing,

    /// API 错误（连接成功但响应异常）
    ApiError {
        error: String,
    },
}

/// 检测 BitBrowser 连接状态
pub async fn check_status() -> ConnectionStatus {
    // 尝试连接 API
    match test_api_connection().await {
        Ok(_) => {
            ConnectionStatus::Connected {
                message: "BitBrowser 已连接".to_string(),
            }
        }
        Err(e) => {
            // 连接失败，诊断原因
            diagnose_disconnect_reason(e).await
        }
    }
}

/// 测试 API 连接（带重试机制）
async fn test_api_connection() -> Result<(), ApiError> {
    // 最多尝试 3 次
    const MAX_RETRIES: u32 = 3;
    const RETRY_DELAY_MS: u64 = 1000;

    let mut last_error = None;

    for attempt in 1..=MAX_RETRIES {
        if attempt > 1 {
            tokio::time::sleep(std::time::Duration::from_millis(RETRY_DELAY_MS)).await;
        }

        match try_connect_once().await {
            Ok(_) => return Ok(()),
            Err(e) => last_error = Some(e),
        }
    }

    // 所有重试都失败
    Err(last_error.unwrap())
}

/// 单次连接尝试
async fn try_connect_once() -> Result<(), ApiError> {
    // 创建 HTTP 客户端（禁用代理以避免 502 错误）
    let client = reqwest::Client::builder()
        .no_proxy()  // 关键修复：禁用代理
        .build()
        .map_err(|e| ApiError::RequestFailed(e.to_string()))?;

    let request_body = serde_json::json!({
        "page": 0,
        "pageSize": 1
    });

    // 发送请求
    let response = client
        .post(format!("{}/browser/list", API_BASE_URL))
        .json(&request_body)
        .send()
        .await
        .map_err(|e| ApiError::RequestFailed(e.to_string()))?;

    // 检查 HTTP 状态码
    let status = response.status();
    if !status.is_success() {
        return Err(ApiError::HttpError(status.as_u16()));
    }

    // 解析并验证响应
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| ApiError::ResponseReadFailed(e.to_string()))?;

    // 验证 BitBrowser API 响应结构
    if json.get("success").is_none() || json.get("data").and_then(|d| d.get("list")).is_none() {
        return Err(ApiError::InvalidResponse("无效的响应格式".to_string()));
    }

    Ok(())
}

/// 诊断断连原因
async fn diagnose_disconnect_reason(api_error: ApiError) -> ConnectionStatus {
    // 1. 检查 BitBrowser 进程是否运行
    if !is_bitbrowser_running() {
        return ConnectionStatus::Disconnected {
            reason: DisconnectReason::NotRunning,
            message: "BitBrowser 未运行".to_string(),
        };
    }

    // 2. BitBrowser 进程在运行，检查端口占用情况
    if let Some(pid) = find_process_using_port(API_PORT) {
        let mut system = System::new_all();
        system.refresh_processes();
        let sys_pid = sysinfo::Pid::from_u32(pid);

        if let Some(process) = system.process(sys_pid) {
            let process_name = process.name().to_string();

            // 检查是否是 BitBrowser 自己占用的端口
            if is_bitbrowser_process(&process_name) {
                // BitBrowser 占用端口但 API 无响应
                // 可能是正在初始化，也可能是 API 错误
                match api_error {
                    ApiError::RequestFailed(_) => {
                        // 连接超时或拒绝连接 -> 正在初始化
                        return ConnectionStatus::Disconnected {
                            reason: DisconnectReason::Initializing,
                            message: "BitBrowser 正在启动，请稍候...".to_string(),
                        };
                    }
                    ApiError::HttpError(502) | ApiError::HttpError(503) | ApiError::HttpError(504) => {
                        // 502/503/504 表示服务器暂时不可用，通常是正在初始化
                        return ConnectionStatus::Disconnected {
                            reason: DisconnectReason::Initializing,
                            message: "BitBrowser API 正在初始化，请稍候...".to_string(),
                        };
                    }
                    _ => {
                        // 其他 API 错误
                        return ConnectionStatus::Disconnected {
                            reason: DisconnectReason::ApiError {
                                error: api_error.to_string(),
                            },
                            message: "BitBrowser API 响应异常".to_string(),
                        };
                    }
                }
            } else {
                // 端口被其他进程占用
                return ConnectionStatus::Disconnected {
                    reason: DisconnectReason::PortOccupied {
                        process_name: process_name.clone(),
                        process_id: pid,
                    },
                    message: format!(
                        "端口 {} 被进程 {} (PID: {}) 占用",
                        API_PORT, process_name, pid
                    ),
                };
            }
        }
    }

    // 3. 端口未被占用，但 BitBrowser 在运行且 API 失败
    // 这是一种异常情况
    ConnectionStatus::Disconnected {
        reason: DisconnectReason::ApiError {
            error: api_error.to_string(),
        },
        message: "BitBrowser 运行中但无法连接 API".to_string(),
    }
}

/// API 错误类型
#[derive(Debug)]
enum ApiError {
    RequestFailed(String),
    HttpError(u16),
    ResponseReadFailed(String),
    InvalidResponse(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiError::RequestFailed(msg) => write!(f, "请求失败: {}", msg),
            ApiError::HttpError(code) => write!(f, "HTTP 错误: {}", code),
            ApiError::ResponseReadFailed(msg) => write!(f, "响应读取失败: {}", msg),
            ApiError::InvalidResponse(msg) => write!(f, "无效响应: {}", msg),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_status() {
        // 这个测试需要 BitBrowser 实际运行
        let status = check_status().await;
        println!("连接状态: {:?}", status);
    }
}
