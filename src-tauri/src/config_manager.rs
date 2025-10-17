/**
 * 配置管理模块
 * 统一管理所有应用配置，使用JSON文件持久化
 */
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

// 配置文件路径
fn get_config_path() -> PathBuf {
    let app_data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.toolbox.dev");

    // 确保目录存在
    fs::create_dir_all(&app_data_dir).ok();

    app_data_dir.join("settings.json")
}

// 账号信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub nickname: String,
    pub avatar: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wechat_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finder_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub appuin: Option<String>,
}

// 账号数据（只存储不可变数据）
// 设计原则：
// - ✅ 只缓存不常变动的基本信息：nickname, avatar, finderUsername 等
// - ❌ 不缓存动态状态，实时从云端获取：loginMethod, cookieStatus 等
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountData {
    pub account_info: AccountInfo,
    pub updated_at: String,
    // ✅ 以下动态数据改为可选（已废弃，不再使用）：
    #[serde(skip_serializing_if = "Option::is_none")]
    pub login_method: Option<String>, // @deprecated 从云端实时获取
    #[serde(skip_serializing_if = "Option::is_none")]
    pub login_time: Option<i64>, // @deprecated 不再存储
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link_token: Option<String>, // 永久链接Token（用于删除云端链接和恢复订阅）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sync_time: Option<i64>, // @deprecated 不再存储
}

// 完整配置结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    // 基础配置
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bitbrowser_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bitbrowser_api: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter_my_accounts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub member_mode: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub test_persistence_mode: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bitbrowser_vip_mode: Option<bool>,

    // 账号信息（browser_id -> AccountData）
    #[serde(default)]
    pub browser_accounts: HashMap<String, AccountData>,
}

// 全局配置实例
pub struct ConfigManager {
    config: Mutex<AppConfig>,
}

impl ConfigManager {
    pub fn new() -> Self {
        let config = Self::load_config();
        ConfigManager {
            config: Mutex::new(config),
        }
    }

    // 加载配置文件
    fn load_config() -> AppConfig {
        let config_path = get_config_path();

        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                    return config;
                }
            }
        }

        AppConfig::default()
    }

    // 保存配置文件
    fn save_config(&self) -> Result<(), String> {
        let config = self.config.lock().unwrap();
        let config_path = get_config_path();

        let json =
            serde_json::to_string_pretty(&*config).map_err(|e| format!("序列化配置失败: {}", e))?;

        fs::write(&config_path, json).map_err(|e| format!("写入配置文件失败: {}", e))?;

        Ok(())
    }

    // ========== 基础配置方法 ==========

    pub fn get_string(&self, key: &str) -> Option<String> {
        let config = self.config.lock().unwrap();
        match key {
            "bitbrowser_path" => config.bitbrowser_path.clone(),
            "bitbrowser_api" => config.bitbrowser_api.clone(),
            "username" => config.username.clone(),
            _ => None,
        }
    }

    pub fn set_string(&self, key: &str, value: String) -> Result<(), String> {
        let mut config = self.config.lock().unwrap();
        match key {
            "bitbrowser_path" => config.bitbrowser_path = Some(value),
            "bitbrowser_api" => config.bitbrowser_api = Some(value),
            "username" => config.username = Some(value),
            _ => return Err(format!("未知的配置项: {}", key)),
        }
        drop(config);
        self.save_config()
    }

    pub fn get_bool(&self, key: &str) -> Option<bool> {
        let config = self.config.lock().unwrap();
        match key {
            "filter_my_accounts" => config.filter_my_accounts,
            "member_mode" => config.member_mode,
            "test_persistence_mode" => config.test_persistence_mode,
            "bitbrowser_vip_mode" => config.bitbrowser_vip_mode,
            _ => None,
        }
    }

    pub fn set_bool(&self, key: &str, value: bool) -> Result<(), String> {
        let mut config = self.config.lock().unwrap();
        match key {
            "filter_my_accounts" => config.filter_my_accounts = Some(value),
            "member_mode" => config.member_mode = Some(value),
            "test_persistence_mode" => config.test_persistence_mode = Some(value),
            "bitbrowser_vip_mode" => config.bitbrowser_vip_mode = Some(value),
            _ => return Err(format!("未知的配置项: {}", key)),
        }
        drop(config);
        self.save_config()
    }

    // ========== 账号信息管理 ==========

    pub fn get_all_accounts(&self) -> HashMap<String, AccountData> {
        let config = self.config.lock().unwrap();
        config.browser_accounts.clone()
    }

    pub fn get_account(&self, browser_id: &str) -> Option<AccountData> {
        let config = self.config.lock().unwrap();
        config.browser_accounts.get(browser_id).cloned()
    }

    pub fn save_account(
        &self,
        browser_id: String,
        account_data: AccountData,
    ) -> Result<(), String> {
        let mut config = self.config.lock().unwrap();
        config.browser_accounts.insert(browser_id, account_data);
        drop(config);
        self.save_config()
    }

    pub fn delete_account(&self, browser_id: &str) -> Result<(), String> {
        let mut config = self.config.lock().unwrap();
        config.browser_accounts.remove(browser_id);
        drop(config);
        self.save_config()
    }

    pub fn delete_accounts(&self, browser_ids: Vec<String>) -> Result<(), String> {
        let mut config = self.config.lock().unwrap();
        for browser_id in browser_ids {
            config.browser_accounts.remove(&browser_id);
        }
        drop(config);
        self.save_config()
    }
}

// ========== Tauri 命令 ==========

#[tauri::command]
pub fn config_get_string(key: String, state: tauri::State<ConfigManager>) -> Option<String> {
    state.get_string(&key)
}

#[tauri::command]
pub fn config_set_string(
    key: String,
    value: String,
    state: tauri::State<ConfigManager>,
) -> Result<(), String> {
    state.set_string(&key, value)
}

#[tauri::command]
pub fn config_get_bool(key: String, state: tauri::State<ConfigManager>) -> Option<bool> {
    state.get_bool(&key)
}

#[tauri::command]
pub fn config_set_bool(
    key: String,
    value: bool,
    state: tauri::State<ConfigManager>,
) -> Result<(), String> {
    state.set_bool(&key, value)
}

#[tauri::command]
pub fn config_get_all_accounts(state: tauri::State<ConfigManager>) -> HashMap<String, AccountData> {
    state.get_all_accounts()
}

#[tauri::command]
pub fn config_get_account(
    browser_id: String,
    state: tauri::State<ConfigManager>,
) -> Option<AccountData> {
    state.get_account(&browser_id)
}

#[tauri::command]
pub fn config_save_account(
    browser_id: String,
    account_data: AccountData,
    state: tauri::State<ConfigManager>,
) -> Result<(), String> {
    state.save_account(browser_id, account_data)
}

#[tauri::command]
pub fn config_delete_account(
    browser_id: String,
    state: tauri::State<ConfigManager>,
) -> Result<(), String> {
    state.delete_account(&browser_id)
}

#[tauri::command]
pub fn config_delete_accounts(
    browser_ids: Vec<String>,
    state: tauri::State<ConfigManager>,
) -> Result<(), String> {
    state.delete_accounts(browser_ids)
}
