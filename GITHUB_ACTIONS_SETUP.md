# GitHub Actions 自动发布配置指南

## 📋 配置步骤

### 1. 添加 GitHub Secrets

访问：https://github.com/Zhangyuc2025/video-toolbox/settings/secrets/actions

点击 "New repository secret"，添加以下两个密钥：

#### Secret 1: `TAURI_PRIVATE_KEY`
**值：**
```
dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5CmI1NmgwYnc5c2NrQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQVJkd1lweGFPbFlRMEJOaDhBQUFBUUJBQUFBQUFBQUFBRVVWYmhSY3dmR1FjWDBwelVvZlZjZ3BkTWgwd3hqRFNNemlzY1JEOEtyVDVtS3VQN2NycVNtbUFqZlpmVmRvYko3N053ZzhtVzQrdXAvMTZSWnJ0ak8wU09hUEovWDg9Cg==
```

#### Secret 2: `TAURI_KEY_PASSWORD`
**值：** (留空)

---

### 2. 使用方法

#### 方式一：通过 Git 命令发布（推荐）

```bash
# 1. 修改代码后提交
git add .
git commit -m "feat: 新功能"

# 2. 打 tag（版本号格式：v主版本.次版本.修订号）
git tag v1.0.2

# 3. 推送到 GitHub
git push origin main
git push origin v1.0.2

# 4. GitHub Actions 会自动：
#    - 打包应用
#    - 创建 Release
#    - 上传安装包和更新包
#    - 生成 latest.json 更新清单
```

#### 方式二：在 GitHub 网页创建 Release

1. 访问：https://github.com/Zhangyuc2025/video-toolbox/releases/new
2. Tag version 填：`v1.0.2`（必须以 v 开头）
3. 点击 "Publish release"
4. GitHub Actions 自动触发构建

---

### 3. 版本号规则

遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

- `v1.0.0` → `v1.0.1`：修复 bug（Patch）
- `v1.0.0` → `v1.1.0`：新功能（Minor）
- `v1.0.0` → `v2.0.0`：重大更新（Major）

**注意：** Tag 必须以 `v` 开头，例如 `v1.0.2`

---

### 4. 查看构建状态

- 访问：https://github.com/Zhangyuc2025/video-toolbox/actions
- 点击最新的 "Release" workflow 查看进度
- 构建通常需要 5-10 分钟

---

### 5. 测试更新

1. 安装旧版本应用（例如 v1.0.0）
2. 打开应用，点击"检查更新"
3. 应用会自动从 GitHub 检测到新版本并提示更新

---

## 🎯 优势

✅ **完全自动化**：打 tag 后全自动构建发布
✅ **无需手动上传**：自动生成 latest.json
✅ **签名自动处理**：使用 GitHub Secrets 安全存储密钥
✅ **多平台支持**：可扩展到 macOS、Linux

---

## ⚠️ 注意事项

1. **首次推送** tag 前，必须先配置好 GitHub Secrets
2. **Tag 格式** 必须是 `v1.2.3` 格式，否则不会触发
3. **删除 Release** 后需要同时删除对应的 Tag
4. **构建失败** 时查看 Actions 页面的错误日志

---

## 🔧 本地脚本

如果需要本地打包测试，仍然可以使用：
- `scripts\release.bat` - 本地打包
- 但不再需要 `upload-update-interactive.bat`

---

## 📝 旧工作流对比

### 旧方式（手动）：
1. 运行 `release.bat` 打包
2. 手动创建 GitHub Release
3. 手动上传 3 个文件
4. 运行 `upload-update-interactive.bat`
5. 粘贴 GitHub URL

### 新方式（自动）：
1. `git tag v1.0.2 && git push --tags`
2. ✅ 完成！

---

## 🎉 完成

配置完成后，您只需要专注于写代码，发布全自动！
