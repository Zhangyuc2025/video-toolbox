# 应用发布完整指南

## 📋 发布步骤

### 步骤 1：生成签名密钥（首次发布）

打开命令行，执行：

```bash
cd toolbox
npx @tauri-apps/cli signer generate -w %USERPROFILE%\.tauri\videotoolbox.key
```

**提示输入密码时：**
- 可以直接回车（使用空密码）
- 或设置一个密码（需要记住，每次打包都要用）

**密钥生成后会显示公钥，例如：**
```
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXkgQjIzRTU2MzcxMjQ4MzIzQQpSV1JCMHE1...
```

**复制公钥，更新配置：**

编辑 `src-tauri/tauri.conf.json`，找到：
```json
"pubkey": "YOUR_PUBLIC_KEY_HERE"
```

替换为你的公钥。

---

### 步骤 2：打包应用

```bash
cd toolbox
pnpm tauri:build
```

**打包完成后，文件位置：**
- Windows: `src-tauri/target/release/bundle/msi/`
  - `视频号工具箱_1.0.0_x64.msi` - 安装包
  - `视频号工具箱_1.0.0_x64.msi.zip` - 压缩包
  - `视频号工具箱_1.0.0_x64.msi.zip.sig` - **签名文件（重要！）**

---

### 步骤 3：发布首个版本

**首次发布不需要上传更新信息**，直接分发 `.msi` 文件给用户安装即可。

---

### 步骤 4：发布更新版本

#### 4.1 修改版本号

编辑以下文件的版本号：
- `package.json` → `"version": "1.0.1"`
- `src-tauri/tauri.conf.json` → `"version": "1.0.1"`
- `src-tauri/Cargo.toml` → `version = "1.0.1"`

#### 4.2 重新打包

```bash
pnpm tauri:build
```

#### 4.3 上传安装包到云存储

**选项 A：使用 Cloudflare R2**

```bash
# 安装 wrangler（如果还没安装）
npm install -g wrangler

# 上传安装包
wrangler r2 object put tauri-app-updates/releases/windows-x86_64/1.0.1/app.msi --file="src-tauri/target/release/bundle/msi/视频号工具箱_1.0.1_x64.msi.zip"

# 上传签名
wrangler r2 object put tauri-app-updates/releases/windows-x86_64/1.0.1/app.msi.sig --file="src-tauri/target/release/bundle/msi/视频号工具箱_1.0.1_x64.msi.zip.sig"
```

**选项 B：使用其他云存储**
- 上传到腾讯云 COS / 阿里云 OSS
- 或使用 GitHub Releases
- 获取公开下载链接

#### 4.4 获取签名内容

```bash
# Windows
type "src-tauri\target\release\bundle\msi\视频号工具箱_1.0.1_x64.msi.zip.sig"

# 复制输出的内容
```

#### 4.5 创建更新清单

创建文件 `update-manifest.json`：

```json
{
  "version": "1.0.1",
  "notes": "更新内容：\n- 修复了登录问题\n- 新增批量操作功能\n- 优化了界面性能",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkK...",
      "url": "https://你的R2域名/releases/windows-x86_64/1.0.1/app.msi"
    }
  }
}
```

**字段说明：**
- `signature`: 从 `.sig` 文件读取的完整内容
- `url`: 安装包的公开下载地址

#### 4.6 上传更新清单到服务器

```bash
# 方式1: 使用 curl（需要设置 ADMIN_TOKEN）
curl -X POST https://permanent-link-service.zhangyuc2020.workers.dev/api/updater/upload \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d @update-manifest.json

# 方式2: 使用 PowerShell
$headers = @{
    "Authorization" = "Bearer YOUR_ADMIN_TOKEN"
    "Content-Type" = "application/json"
}
$body = Get-Content update-manifest.json -Raw
Invoke-RestMethod -Uri "https://permanent-link-service.zhangyuc2020.workers.dev/api/updater/upload" -Method Post -Headers $headers -Body $body
```

**成功响应：**
```json
{
  "success": true,
  "message": "版本信息已上传",
  "version": "1.0.1"
}
```

---

### 步骤 5：验证更新

1. 安装旧版本（1.0.0）
2. 打开应用，进入设置页
3. 点击"检查更新"
4. 应该显示新版本（1.0.1）
5. 点击"立即更新"，等待下载安装
6. 应用自动重启到新版本

---

## 🔧 设置 ADMIN_TOKEN

在 Cloudflare Workers 中设置管理员令牌：

```bash
cd permanent-link-service-workers
wrangler secret put ADMIN_TOKEN
# 输入你的密码，例如: my-secure-token-2024
```

记住这个令牌，上传更新时需要用到。

---

## 📝 快速发布检查清单

**首次发布：**
- [ ] 生成签名密钥对
- [ ] 更新 `tauri.conf.json` 中的公钥
- [ ] 打包应用（`pnpm tauri:build`）
- [ ] 分发 `.msi` 安装包

**后续更新：**
- [ ] 修改版本号（3个文件）
- [ ] 打包应用
- [ ] 上传 `.msi.zip` 和 `.msi.zip.sig` 到云存储
- [ ] 读取 `.sig` 文件内容
- [ ] 创建更新清单 JSON
- [ ] 使用 ADMIN_TOKEN 上传清单到 Workers
- [ ] 测试验证更新流程

---

## ⚠️ 重要提示

1. **私钥安全**
   - 私钥文件：`%USERPROFILE%\.tauri\videotoolbox.key`
   - 务必备份，丢失将无法发布更新
   - 不要提交到 Git 仓库

2. **签名验证**
   - 每个安装包必须有对应的 `.sig` 签名文件
   - 签名必须用相同的私钥生成
   - 客户端会验证签名，无效签名会拒绝安装

3. **版本号规则**
   - 使用语义化版本：`主版本.次版本.修订号`
   - 只有版本号更高才会触发更新
   - 确保所有文件的版本号一致

4. **测试建议**
   - 先在测试环境验证更新流程
   - 确认签名验证正常
   - 检查下载链接可访问

---

## 🆘 常见问题

### Q: 更新检查失败？
A: 检查网络连接和 Workers 服务状态

### Q: 签名验证失败？
A: 确保公钥和私钥匹配，重新生成密钥对

### Q: 下载失败？
A: 检查安装包 URL 是否正确且可访问

### Q: 如何回滚版本？
A: 上传旧版本的清单到 Workers

---

**完成！** 🎉
