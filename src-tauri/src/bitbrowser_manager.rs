/**
 * BitBrowser Manager
 * 负责查找、启动和管理 BitBrowser 客户端
 */
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, Instant};
use sysinfo::System;

/// 可能的 BitBrowser 可执行文件名
const POSSIBLE_EXE_NAMES: &[&str] = &[
    "BitBrowser.exe",
    "比特浏览器.exe",
    "bitbrowser.exe",
    "BitBrowser_Client.exe",
    "BitBrowserClient.exe",
];

/// 缓存文件名
const CACHE_FILE_NAME: &str = "bitbrowser_path_cache.txt";

/// 深度搜索超时时间（秒）
const DEEP_SEARCH_TIMEOUT_SECS: u64 = 60;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitBrowserInfo {
    pub path: Option<String>,
    pub is_running: bool,
    pub process_id: Option<u32>,
}

/// 检查目录中是否存在 BitBrowser 可执行文件（支持多种文件名）
fn find_exe_in_directory(dir: &PathBuf) -> Option<String> {
    for exe_name in POSSIBLE_EXE_NAMES {
        let exe_path = dir.join(exe_name);
        if exe_path.exists() {
            return Some(exe_path.to_string_lossy().to_string());
        }
    }
    None
}

/// 检查进程名是否匹配 BitBrowser
pub fn is_bitbrowser_process(name: &str) -> bool {
    let name_lower = name.to_lowercase();
    name_lower.contains("bitbrowser")
        || name_lower.contains("bit browser")
        || name.contains("比特浏览器")
}

/// 检查 BitBrowser 是否正在运行
pub fn is_bitbrowser_running() -> bool {
    let mut system = System::new_all();
    system.refresh_processes();

    for (_pid, process) in system.processes() {
        let name = process.name().to_string();
        if is_bitbrowser_process(&name) {
            return true;
        }
    }

    false
}

/// 获取正在运行的 BitBrowser 进程信息
pub fn get_running_bitbrowser_info() -> Option<BitBrowserInfo> {
    let mut system = System::new_all();
    system.refresh_processes();

    for (pid, process) in system.processes() {
        let name = process.name().to_string();
        if is_bitbrowser_process(&name) {
            // 尝试获取进程路径
            let path = process
                .exe()
                .and_then(|p| p.to_str())
                .map(|s| s.to_string());

            return Some(BitBrowserInfo {
                path,
                is_running: true,
                process_id: Some(pid.as_u32()),
            });
        }
    }

    None
}

/// 从 Windows 注册表查找 BitBrowser 安装路径
#[cfg(target_os = "windows")]
pub fn find_bitbrowser_in_registry() -> Option<String> {
    // 检查 HKEY_LOCAL_MACHINE 和 HKEY_CURRENT_USER
    let registry_roots = vec![(HKEY_LOCAL_MACHINE, "HKLM"), (HKEY_CURRENT_USER, "HKCU")];

    let registry_paths = vec![
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ];

    for (root, _root_name) in registry_roots {
        for base_path in &registry_paths {
            if let Ok(reg_key) = RegKey::predef(root).open_subkey(base_path) {
                for key_name in reg_key.enum_keys().filter_map(|k| k.ok()) {
                    if let Ok(subkey) = reg_key.open_subkey(&key_name) {
                        // 检查显示名称
                        if let Ok(display_name) = subkey.get_value::<String, _>("DisplayName") {
                            if display_name.to_lowercase().contains("bitbrowser")
                                || display_name.to_lowercase().contains("bit browser")
                                || display_name.contains("比特浏览器")
                            {
                                // 尝试获取安装位置
                                if let Ok(install_location) =
                                    subkey.get_value::<String, _>("InstallLocation")
                                {
                                    let install_dir = PathBuf::from(&install_location);
                                    if let Some(exe_path) = find_exe_in_directory(&install_dir) {
                                        return Some(exe_path);
                                    }
                                }

                                // 尝试从 DisplayIcon 获取路径
                                if let Ok(icon_path) = subkey.get_value::<String, _>("DisplayIcon")
                                {
                                    let exe_path = PathBuf::from(icon_path.trim_matches('"'));
                                    if exe_path.exists()
                                        && exe_path.extension().map_or(false, |e| e == "exe")
                                    {
                                        return Some(exe_path.to_string_lossy().to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

#[cfg(not(target_os = "windows"))]
pub fn find_bitbrowser_in_registry() -> Option<String> {
    None
}

/// 获取所有可用的逻辑盘符
#[cfg(target_os = "windows")]
fn get_available_drives() -> Vec<String> {
    let mut drives = Vec::new();
    for letter in b'A'..=b'Z' {
        let drive = format!("{}:\\", letter as char);
        let path = PathBuf::from(&drive);
        if path.exists() {
            drives.push(drive);
        }
    }
    drives
}

#[cfg(not(target_os = "windows"))]
fn get_available_drives() -> Vec<String> {
    vec!["/".to_string()]
}

/// 扫描常见安装目录（所有盘符）
pub fn scan_common_directories() -> Option<String> {
    // 优先检查用户目录
    if let Some(home_dir) = dirs::home_dir() {
        let user_paths = vec![
            home_dir.join("AppData\\Local\\BitBrowser"),
            home_dir.join("AppData\\Roaming\\BitBrowser"),
            home_dir.join("AppData\\Local\\比特浏览器"),
            home_dir.join("AppData\\Roaming\\比特浏览器"),
            home_dir.join("Desktop\\BitBrowser"),
            home_dir.join("Desktop\\比特浏览器"),
            home_dir.join("Downloads\\BitBrowser"),
            home_dir.join("Downloads\\比特浏览器"),
        ];

        for path in user_paths {
            if let Some(exe_path) = find_exe_in_directory(&path) {
                return Some(exe_path);
            }
        }
    }

    // 扫描所有盘符的常见软件目录
    let drives = get_available_drives();
    let common_dirs = vec![
        "Program Files\\BitBrowser",
        "Program Files (x86)\\BitBrowser",
        "Program Files\\比特浏览器",
        "Program Files (x86)\\比特浏览器",
        "BitBrowser",
        "比特浏览器",
        "Software\\BitBrowser",
        "Software\\比特浏览器",
        "Apps\\BitBrowser",
        "Apps\\比特浏览器",
        "Tools\\BitBrowser",
        "Tools\\比特浏览器",
    ];

    for drive in drives {
        for dir in &common_dirs {
            let path = PathBuf::from(&drive).join(dir);
            if let Some(exe_path) = find_exe_in_directory(&path) {
                return Some(exe_path);
            }
        }
    }

    None
}

/// 从开始菜单快捷方式查找
#[cfg(target_os = "windows")]
pub fn find_in_start_menu() -> Option<String> {
    let start_menu_paths = vec![PathBuf::from(
        r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs",
    )];

    // 添加用户开始菜单
    if let Some(home_dir) = dirs::home_dir() {
        let user_start_menu =
            home_dir.join(r"AppData\Roaming\Microsoft\Windows\Start Menu\Programs");
        if user_start_menu.exists() {
            // 递归搜索 .lnk 文件（中英文关键词）
            for keyword in &["bitbrowser", "比特浏览器"] {
                if let Some(path) = search_lnk_files(&user_start_menu, keyword) {
                    return Some(path);
                }
            }
        }
    }

    for start_menu in start_menu_paths {
        if start_menu.exists() {
            for keyword in &["bitbrowser", "比特浏览器"] {
                if let Some(path) = search_lnk_files(&start_menu, keyword) {
                    return Some(path);
                }
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn search_lnk_files(dir: &PathBuf, keyword: &str) -> Option<String> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();

            if path.is_dir() {
                // 递归搜索子目录（限制深度为3）
                if let Some(result) = search_lnk_files(&path, keyword) {
                    return Some(result);
                }
            } else if path.extension().map_or(false, |e| e == "lnk") {
                if let Some(file_name) = path.file_name() {
                    if file_name.to_string_lossy().to_lowercase().contains(keyword) {
                        // 找到快捷方式，尝试解析目标路径
                        // 注意：解析 .lnk 需要额外的库，这里简化处理
                        // 可以考虑使用 mslnk 或 lnk-parser crate
                        println!("找到快捷方式: {:?}", path);
                    }
                }
            }
        }
    }

    None
}

#[cfg(not(target_os = "windows"))]
pub fn find_in_start_menu() -> Option<String> {
    None
}

// ==================== 路径缓存管理 ====================

/// 获取缓存文件路径
fn get_cache_file_path() -> Option<PathBuf> {
    if let Some(home_dir) = dirs::home_dir() {
        let cache_dir = home_dir.join(".bitbrowser");

        // 确保缓存目录存在
        if !cache_dir.exists() {
            let _ = fs::create_dir_all(&cache_dir);
        }

        Some(cache_dir.join(CACHE_FILE_NAME))
    } else {
        None
    }
}

/// 读取缓存的路径
fn read_cached_path() -> Option<String> {
    if let Some(cache_path) = get_cache_file_path() {
        if cache_path.exists() {
            if let Ok(mut file) = fs::File::open(&cache_path) {
                let mut contents = String::new();
                if file.read_to_string(&mut contents).is_ok() {
                    let path = contents.trim().to_string();

                    // 验证缓存的路径是否仍然有效
                    if PathBuf::from(&path).exists() {
                        println!("✓ 从缓存读取路径: {}", path);
                        return Some(path);
                    } else {
                        println!("⚠ 缓存路径已失效，将重新搜索");
                        // 删除无效缓存
                        let _ = fs::remove_file(&cache_path);
                    }
                }
            }
        }
    }
    None
}

/// 写入路径到缓存
fn write_cached_path(path: &str) {
    if let Some(cache_path) = get_cache_file_path() {
        if let Ok(mut file) = fs::File::create(&cache_path) {
            let _ = file.write_all(path.as_bytes());
            println!("✓ 路径已缓存: {}", path);
        }
    }
}

/// 清除路径缓存
pub fn clear_cached_path() {
    if let Some(cache_path) = get_cache_file_path() {
        if cache_path.exists() {
            let _ = fs::remove_file(&cache_path);
            println!("✓ 缓存已清除");
        }
    }
}

// ==================== 路径查找 ====================

/// 智能查找 BitBrowser 路径（多策略组合 + 缓存优化）
pub fn find_bitbrowser_path() -> Option<String> {
    println!("开始查找 BitBrowser 安装路径...");

    // 策略0: 优先检查缓存（最快）
    println!("策略0: 检查缓存...");
    if let Some(cached_path) = read_cached_path() {
        return Some(cached_path);
    }

    // 策略1: 检查进程是否已运行（最快，优先级最高）
    println!("策略1: 检查正在运行的进程...");
    if let Some(info) = get_running_bitbrowser_info() {
        if let Some(path) = info.path {
            println!("✓ 从运行进程找到: {}", path);
            write_cached_path(&path);
            return Some(path);
        }
    }

    // 策略2: 从注册表查找（速度快，准确度高）
    println!("策略2: 搜索注册表...");
    if let Some(path) = find_bitbrowser_in_registry() {
        println!("✓ 从注册表找到: {}", path);
        write_cached_path(&path);
        return Some(path);
    }

    // 策略3: 扫描所有盘符的常见目录
    println!("策略3: 扫描所有盘符的常见目录...");
    if let Some(path) = scan_common_directories() {
        println!("✓ 从目录扫描找到: {}", path);
        write_cached_path(&path);
        return Some(path);
    }

    // 策略4: 搜索开始菜单快捷方式
    #[cfg(target_os = "windows")]
    {
        println!("策略4: 搜索开始菜单...");
        if let Some(path) = find_in_start_menu() {
            println!("✓ 从开始菜单找到: {}", path);
            write_cached_path(&path);
            return Some(path);
        }
    }

    // 策略5: 深度搜索（最后的手段，较慢）
    println!("策略5: 执行深度搜索...");
    if let Some(path) = deep_search_bitbrowser() {
        println!("✓ 从深度搜索找到: {}", path);
        write_cached_path(&path);
        return Some(path);
    }

    println!("✗ 未找到 BitBrowser 安装路径");
    None
}

/// 深度搜索 BitBrowser.exe（遍历所有盘符的根目录，带超时机制）
fn deep_search_bitbrowser() -> Option<String> {
    let start_time = Instant::now();
    let timeout = Duration::from_secs(DEEP_SEARCH_TIMEOUT_SECS);
    let drives = get_available_drives();

    for drive in drives {
        // 检查是否超时
        if start_time.elapsed() >= timeout {
            println!("⚠ 深度搜索超时（{}秒），停止搜索", DEEP_SEARCH_TIMEOUT_SECS);
            break;
        }

        println!("  扫描盘符: {}", drive);
        let drive_path = PathBuf::from(&drive);

        // 只扫描根目录的直接子目录（避免过深的递归）
        if let Ok(entries) = fs::read_dir(&drive_path) {
            for entry in entries.filter_map(|e| e.ok()) {
                // 每处理几个条目检查一次超时
                if start_time.elapsed() >= timeout {
                    println!("⚠ 深度搜索超时（{}秒），停止搜索", DEEP_SEARCH_TIMEOUT_SECS);
                    return None;
                }

                let path = entry.path();

                // 跳过系统目录和隐藏目录
                if let Some(name) = path.file_name() {
                    let name_str = name.to_string_lossy().to_lowercase();
                    if name_str.starts_with('$')
                        || name_str == "windows"
                        || name_str == "system volume information"
                        || name_str == "recycler"
                        || name_str == "$recycle.bin"
                    {
                        continue;
                    }
                }

                if path.is_dir() {
                    // 检查该目录下是否有 BitBrowser 可执行文件
                    if let Some(exe_path) = find_exe_in_directory(&path) {
                        return Some(exe_path);
                    }

                    // 再深入一层查找（常见的软件会有子目录）
                    if let Ok(sub_entries) = fs::read_dir(&path) {
                        for sub_entry in sub_entries.filter_map(|e| e.ok()).take(50) {
                            let sub_path = sub_entry.path();
                            if sub_path.is_dir() {
                                if let Some(exe_path) = find_exe_in_directory(&sub_path) {
                                    return Some(exe_path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

/// 启动 BitBrowser
pub fn start_bitbrowser(path: Option<String>) -> Result<(), String> {
    let exe_path = if let Some(p) = path {
        p
    } else {
        find_bitbrowser_path().ok_or("无法找到 BitBrowser 安装路径")?
    };

    #[cfg(target_os = "windows")]
    {
        Command::new(&exe_path).spawn().map_err(|e| {
            // 启动失败时清除缓存（可能路径已失效）
            clear_cached_path();
            format!("启动 BitBrowser 失败: {}", e)
        })?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(&exe_path).spawn().map_err(|e| {
            // 启动失败时清除缓存（可能路径已失效）
            clear_cached_path();
            format!("启动 BitBrowser 失败: {}", e)
        })?;
    }

    Ok(())
}

/// 终止 BitBrowser 进程
pub fn kill_bitbrowser() -> Result<(), String> {
    let mut system = System::new_all();
    system.refresh_processes();

    let mut killed = false;

    for (_pid, process) in system.processes() {
        let name = process.name().to_string();
        if is_bitbrowser_process(&name) {
            if process.kill() {
                killed = true;
            }
        }
    }

    if killed {
        Ok(())
    } else {
        Err("未找到 BitBrowser 进程".to_string())
    }
}

// ==================== API 端口检测 ====================

/// 比特浏览器默认 API 端口
/// 官方文档确认的默认端口是 54345
const DEFAULT_API_PORT: u16 = 54345;


/// 检查指定端口是否被占用，并返回占用该端口的进程 PID
#[cfg(target_os = "windows")]
pub fn find_process_using_port(port: u16) -> Option<u32> {
    use std::process::Command;

    // 使用 netstat 查找占用指定端口的进程
    let output = Command::new("netstat")
        .args(&["-ano"])
        .output()
        .ok()?;

    let output_str = String::from_utf8_lossy(&output.stdout);

    // 查找包含指定端口的行
    for line in output_str.lines() {
        if line.contains(&format!(":{}", port)) && line.contains("LISTENING") {
            // 提取 PID（最后一列）
            if let Some(pid_str) = line.split_whitespace().last() {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    return Some(pid);
                }
            }
        }
    }

    None
}

#[cfg(not(target_os = "windows"))]
pub fn find_process_using_port(port: u16) -> Option<u32> {
    use std::process::Command;

    // 使用 lsof 查找占用指定端口的进程
    let output = Command::new("lsof")
        .args(&["-i", &format!(":{}", port), "-t"])
        .output()
        .ok()?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    if let Some(first_line) = output_str.lines().next() {
        if let Ok(pid) = first_line.trim().parse::<u32>() {
            return Some(pid);
        }
    }

    None
}



/// 获取比特浏览器 API 基础 URL
/// 比特浏览器的 API 端口固定为 54345，直接返回即可（参考官方 demo）
pub async fn get_api_base_url() -> Result<String, String> {
    Ok(format!("http://127.0.0.1:{}", DEFAULT_API_PORT))
}

