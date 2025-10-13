/**
 * BitBrowser Launcher
 * 负责启动 BitBrowser
 *
 * 功能：
 * - 自动查找 BitBrowser 路径（沿用现有算法）
 * - 启动 BitBrowser 进程
 */
use serde::{Deserialize, Serialize};

use crate::bitbrowser_manager::{
    find_bitbrowser_path,
    start_bitbrowser,
    is_bitbrowser_running,
};

/// 启动结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResult {
    pub success: bool,
    pub message: String,
}

/// 启动 BitBrowser
///
/// # 参数
/// - `path`: 可选的 BitBrowser 路径，如果为 None 则自动查找
///
/// # 返回
/// - `LaunchResult`: 启动结果
pub async fn launch(path: Option<String>) -> LaunchResult {
    // 1. 检查是否已经运行
    if is_bitbrowser_running() {
        println!("⚠ BitBrowser 进程已在运行，无需重复启动");
        return LaunchResult {
            success: true,
            message: "BitBrowser 已经在运行，请稍候连接就绪".to_string(),
        };
    }

    println!("开始启动 BitBrowser...");

    // 2. 确定 BitBrowser 路径
    let exe_path = match path {
        Some(p) => {
            println!("使用指定路径: {}", p);
            p
        }
        None => {
            println!("自动查找 BitBrowser 路径...");
            match find_bitbrowser_path() {
                Some(p) => {
                    println!("✓ 找到路径: {}", p);
                    p
                }
                None => {
                    println!("✗ 未找到 BitBrowser 安装路径");
                    return LaunchResult {
                        success: false,
                        message: "未找到 BitBrowser 安装路径，请手动指定".to_string(),
                    };
                }
            }
        }
    };

    // 3. 启动 BitBrowser
    match start_bitbrowser(Some(exe_path.clone())) {
        Ok(_) => {
            println!("✓ BitBrowser 启动命令已发送");
            println!("  预计 20-30 秒后 API 服务就绪");
            LaunchResult {
                success: true,
                message: "BitBrowser 正在启动，请稍候 20-30 秒...".to_string(),
            }
        }
        Err(e) => {
            println!("✗ BitBrowser 启动失败: {}", e);
            LaunchResult {
                success: false,
                message: format!("启动失败：{}", e),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_launch() {
        let result = launch(None).await;
        println!("启动结果: {:?}", result);
        assert!(result.success || result.message.contains("已经在运行") || result.message.contains("未找到"));
    }
}
