# 使用 GitHub Releases 发布更新指南

## 📦 完整发布流程

### 步骤 1：创建 GitHub 仓库（如果还没有）

1. 访问 https://github.com/new
2. 创建仓库名称，例如：`video-toolbox`
3. 设为 Private（私有）或 Public（公开）
4. 创建仓库

### 步骤 2：推送代码到 GitHub

```bash
cd toolbox
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/video-toolbox.git
git push -u origin main
```

---

### 步骤 3：发布首个版本

#### 3.1 确认打包文件

打包完成后，检查文件：
```
src-tauri/target/release/bundle/nsis/
├── 视频号工具箱_1.0.0_x64-setup.exe          ← 安装包
├── 视频号工具箱_1.0.0_x64-setup.nsis.zip      ← 更新包
└── 视频号工具箱_1.0.0_x64-setup.nsis.zip.sig  ← 签名文件
```

#### 3.2 创建 GitHub Release

1. 访问仓库页面
2. 点击右侧 "Releases" → "Create a new release"
3. 填写信息：
   - **Tag version**: `v1.0.0`
   - **Release title**: `视频号工具箱 v1.0.0`
   - **Description**:
     ```
     ## 新功能
     - 浏览器账号管理
     - 批量操作功能
     - 热更新支持

     ## 安装说明
     下载 .exe 文件双击安装即可
     ```
4. **上传文件**（拖拽到下方）：
   - `视频号工具箱_1.0.0_x64-setup.exe` ← 用户下载这个安装
   - `视频号工具箱_1.0.0_x64-setup.nsis.zip`
   - `视频号工具箱_1.0.0_x64-setup.nsis.zip.sig`

5. 勾选 "Set as the latest release"
6. 点击 "Publish release"

#### 3.3 获取下载链接

发布后，右键点击 `.zip` 文件 → "复制链接地址"

例如：
```
https://github.com/你的用户名/video-toolbox/releases/download/v1.0.0/视频号工具箱_1.0.0_x64-setup.nsis.zip
```

---

### 步骤 4：配置自动更新

#### 4.1 读取签名内容

```bash
# Windows PowerShell
Get-Content "src-tauri\target\release\bundle\nsis\视频号工具箱_1.0.0_x64-setup.nsis.zip.sig"

# 或者用记事本打开
notepad "src-tauri\target\release\bundle\nsis\视频号工具箱_1.0.0_x64-setup.nsis.zip.sig"
```

复制全部内容，例如：
```
dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkK...
```

#### 4.2 创建更新清单

创建文件 `update-manifest.json`：

```json
{
  "version": "1.0.0",
  "notes": "首个正式版本\n- 浏览器账号管理\n- 批量操作功能",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkK...",
      "url": "https://github.com/你的用户名/video-toolbox/releases/download/v1.0.0/视频号工具箱_1.0.0_x64-setup.nsis.zip"
    }
  }
}
```

**重要提示：**
- `signature`: 从 `.sig` 文件复制的完整内容
- `url`: GitHub Release 中 `.zip` 文件的下载链接
- `notes`: 支持 `\n` 换行

#### 4.3 上传到更新服务器

```bash
# 设置你的 ADMIN_TOKEN（在 Cloudflare Workers 中配置的）
$token = "your-admin-token-here"

# 上传更新清单
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = Get-Content update-manifest.json -Raw

Invoke-RestMethod `
  -Uri "https://permanent-link-service.zhangyuc2020.workers.dev/api/updater/upload" `
  -Method Post `
  -Headers $headers `
  -Body $body
```

**成功响应：**
```json
{
  "success": true,
  "message": "版本信息已上传",
  "version": "1.0.0"
}
```

---

### 步骤 5：测试更新

1. 安装应用（使用 `.exe` 安装包）
2. 打开应用 → 进入设置页
3. 点击"检查更新"
4. 如果配置正确，会显示"当前已是最新版本"

---

## 🔄 后续版本更新流程

### 1. 修改版本号

编辑以下文件：
- `package.json` → `"version": "1.0.1"`
- `src-tauri/tauri.conf.json` → `"version": "1.0.1"`
- `src-tauri/Cargo.toml` → `version = "1.0.1"`

### 2. 重新打包

```bash
pnpm tauri:build
```

### 3. 创建新的 GitHub Release

- Tag: `v1.0.1`
- 上传三个文件（.exe + .zip + .sig）

### 4. 更新清单并上传

```json
{
  "version": "1.0.1",
  "notes": "修复了一些问题\n新增了某某功能",
  "platforms": {
    "windows-x86_64": {
      "signature": "新版本的签名...",
      "url": "https://github.com/.../v1.0.1/视频号工具箱_1.0.1_x64-setup.nsis.zip"
    }
  }
}
```

上传到 Workers：
```bash
Invoke-RestMethod ...
```

### 5. 用户自动更新

已安装 1.0.0 的用户：
1. 打开应用会自动检查更新
2. 或手动点击"检查更新"
3. 显示新版本 1.0.1
4. 点击"立即更新"
5. 自动下载、安装、重启

---

## 🎯 关键点总结

| 步骤 | 文件 | 用途 |
|------|------|------|
| 用户安装 | `.exe` | 双击安装应用 |
| 自动更新 | `.zip` | 应用内下载更新包 |
| 签名验证 | `.sig` | 验证更新包未被篡改 |

**发布清单：**
- ✅ GitHub Release 创建完成
- ✅ 三个文件已上传
- ✅ 获取 .zip 下载链接
- ✅ 读取 .sig 签名内容
- ✅ 创建 update-manifest.json
- ✅ 上传到 Workers

---

## ⚠️ 重要提示

### GitHub 下载链接格式

```
https://github.com/{用户名}/{仓库名}/releases/download/{tag}/{文件名}
```

**注意：**
- 链接必须是公开可访问的
- 私有仓库需要 token 认证（不推荐用于更新）
- 文件名包含中文会被 URL 编码

### 网络加速

如果用户下载慢，可以考虑：
1. 使用 GitHub 代理镜像（如 ghproxy.com）
2. 上传到国内云存储（腾讯云 COS/阿里云 OSS）
3. 使用 CDN 加速

### 签名安全

- 私钥文件：`~/.tauri/videotoolbox.key` 务必备份
- 每次打包必须用相同的私钥
- 丢失私钥将无法发布更新

---

## 🆘 常见问题

### Q: 更新下载失败？
A: 检查 GitHub Release 是否为公开，链接是否正确

### Q: 签名验证失败？
A: 确保 `tauri.conf.json` 中的公钥与私钥匹配

### Q: 国内用户下载慢？
A: 使用 ghproxy 代理或上传到国内云存储

### Q: 如何自动化发布？
A: 使用 GitHub Actions 自动打包和发布

---

**完成！** 🎉

现在你可以：
1. 等待打包完成
2. 创建 GitHub Release
3. 上传文件
4. 配置更新清单
5. 用户自动更新
