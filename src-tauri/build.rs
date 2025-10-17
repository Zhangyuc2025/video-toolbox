use std::fs;
use std::path::Path;

fn main() {
    tauri_build::build();

    // 在开发环境下，自动复制 browser-extension 到 target/debug
    #[cfg(debug_assertions)]
    {
        let source = Path::new("../resources/browser-extension");
        let target = Path::new("target/debug/browser-extension");

        if source.exists() {
            // 如果目标已存在，先删除
            if target.exists() {
                let _ = fs::remove_dir_all(target);
            }

            // 递归复制目录
            if let Err(e) = copy_dir_all(source, target) {
                println!("cargo:warning=复制browser-extension失败: {}", e);
            } else {
                println!("cargo:warning=已复制browser-extension到开发环境");
            }
        }
    }
}

#[cfg(debug_assertions)]
fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
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
