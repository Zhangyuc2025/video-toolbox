# Python Sidecar 构建指南

本文档说明如何将 Python 脚本打包为 Tauri Sidecar 可执行文件。

## 什么是 Sidecar？

Sidecar 是 Tauri 应用程序打包的外部二进制文件，它们会随应用一起分发。使用 Sidecar 的优势：

- ✅ 用户无需安装 Python 环境
- ✅ 依赖项已打包，无需 pip install
- ✅ 跨平台一致性
- ✅ 应用体积可控

## 环境要求

### Windows
- Python 3.8+
- PowerShell 5.0+
- 足够的磁盘空间（约 50MB）

### Linux/macOS
- Python 3.8+
- Bash
- 足够的磁盘空间（约 50MB）

## 构建步骤

### Windows

1. **进入目录**
   ```powershell
   cd python-backend
   ```

2. **运行构建脚本**
   ```powershell
   .\build_sidecar.ps1
   ```

3. **验证构建结果**
   ```powershell
   # 检查文件是否存在
   ls dist\bitbrowser-api.exe
   ls ..\src-tauri\binaries\bitbrowser-api-x86_64-pc-windows-msvc.exe
   ```

### Linux/macOS

1. **进入目录**
   ```bash
   cd python-backend
   ```

2. **添加执行权限**
   ```bash
   chmod +x build_sidecar.sh
   ```

3. **运行构建脚本**
   ```bash
   ./build_sidecar.sh
   ```

4. **验证构建结果**
   ```bash
   # 检查文件是否存在
   ls dist/bitbrowser-api
   ls ../src-tauri/binaries/bitbrowser-api-*
   ```

## 构建产物

构建成功后会生成以下文件：

### 开发构建产物
- `dist/bitbrowser-api.exe` (Windows)
- `dist/bitbrowser-api` (Linux/macOS)

### Tauri 集成产物
- `../src-tauri/binaries/bitbrowser-api-x86_64-pc-windows-msvc.exe` (Windows x64)
- `../src-tauri/binaries/bitbrowser-api-x86_64-unknown-linux-gnu` (Linux x64)
- `../src-tauri/binaries/bitbrowser-api-x86_64-apple-darwin` (macOS Intel)
- `../src-tauri/binaries/bitbrowser-api-aarch64-apple-darwin` (macOS M1/M2)

## 命名规范

Tauri 使用特定的命名格式来识别不同平台的二进制文件：

```
<binary-name>-<target-triple>[.exe]
```

示例：
- Windows: `bitbrowser-api-x86_64-pc-windows-msvc.exe`
- Linux: `bitbrowser-api-x86_64-unknown-linux-gnu`
- macOS Intel: `bitbrowser-api-x86_64-apple-darwin`
- macOS ARM: `bitbrowser-api-aarch64-apple-darwin`

## 测试 Sidecar

### 独立测试

```bash
# Windows
dist\bitbrowser-api.exe check

# Linux/macOS
dist/bitbrowser-api check
```

期望输出（比特浏览器未运行时）：
```json
{"success": false, "message": "连接失败，请检查比特浏览器是否运行"}
```

### Tauri 集成测试

在 Tauri 应用中调用：

```rust
use tauri::api::process::Command;

#[tauri::command]
async fn test_sidecar() -> Result<String, String> {
    let (mut rx, _child) = Command::new_sidecar("bitbrowser-api")
        .expect("failed to create sidecar command")
        .args(&["check"])
        .spawn()
        .expect("Failed to spawn sidecar");

    let mut output = String::new();
    while let Some(event) = rx.recv().await {
        if let tauri::api::process::CommandEvent::Stdout(line) = event {
            output.push_str(&line);
        }
    }
    Ok(output)
}
```

## 常见问题

### Q: 构建时间过长？
A: PyInstaller 首次构建会分析所有依赖，通常需要 1-3 分钟。后续构建会更快。

### Q: 可执行文件太大？
A: 当前配置已排除不必要的依赖（selenium、PIL等），最终大小约 10-15MB。可以进一步优化：
- 使用 UPX 压缩（已启用）
- 排除更多不需要的模块
- 使用虚拟环境构建以减少依赖

### Q: 运行时报错"找不到模块"？
A: 检查 `bitbrowser_api.spec` 中的 `hiddenimports` 列表，添加缺失的模块。

### Q: 如何支持新平台？
A: 在对应平台上运行构建脚本，生成对应的 target-triple 文件即可。

## 自动化构建

可以将构建过程集成到 CI/CD：

### GitHub Actions 示例

```yaml
name: Build Sidecars

on: [push, pull_request]

jobs:
  build-sidecars:
    strategy:
      matrix:
        os: [windows-latest, ubuntu-latest, macos-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Build Sidecar (Windows)
        if: matrix.os == 'windows-latest'
        run: |
          cd python-backend
          .\build_sidecar.ps1

      - name: Build Sidecar (Unix)
        if: matrix.os != 'windows-latest'
        run: |
          cd python-backend
          chmod +x build_sidecar.sh
          ./build_sidecar.sh

      - name: Upload Artifacts
        uses: actions/upload-artifact@v3
        with:
          name: sidecar-${{ matrix.os }}
          path: src-tauri/binaries/*
```

## 开发建议

1. **开发阶段**：直接使用 Python 脚本调试，无需每次都打包
2. **测试阶段**：打包后在本地测试 Sidecar 调用
3. **发布阶段**：CI/CD 自动构建所有平台的 Sidecar

## 维护说明

当修改 Python 代码后：

1. 重新运行构建脚本
2. 测试新的可执行文件
3. 提交 `src-tauri/binaries/` 中的新文件到 Git（可选）

注意：一些团队选择不提交二进制文件到 Git，而是在 CI/CD 中构建。

## 参考资料

- [Tauri Sidecar 文档](https://tauri.app/v1/guides/building/sidecar)
- [PyInstaller 文档](https://pyinstaller.org/en/stable/)
- [Rust Command API](https://docs.rs/tauri/latest/tauri/api/process/struct.Command.html)
