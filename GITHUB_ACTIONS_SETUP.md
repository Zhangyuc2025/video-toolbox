# GitHub Actions 自动发布配置指南

## ✅ 已完成配置

GitHub Actions 自动发布已配置完成，无需额外操作。

---

## 🚀 发布新版本

### 方式一：Git 命令（推荐）

```bash
# 1. 修改代码后提交
git add .
git commit -m "feat: 新功能描述"
git push origin master

# 2. 打 tag 并推送（会自动触发构建）
git tag v1.0.3
git push origin v1.0.3

# 3. 等待 5-10 分钟，GitHub Actions 自动完成：
#    ✅ 编译打包
#    ✅ 创建 Release
#    ✅ 上传安装包
#    ✅ 生成更新清单
```

### 方式二：GitHub 网页

1. 访问：https://github.com/Zhangyuc2025/video-toolbox/releases/new
2. Tag version 填：`v1.0.3`（必须以 v 开头）
3. 点击 "Publish release"
4. GitHub Actions 自动触发构建

---

## 📋 版本号规则

遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

- **Patch**（修复）：`v1.0.2` → `v1.0.3`
- **Minor**（新功能）：`v1.0.3` → `v1.1.0`
- **Major**（重大更新）：`v1.1.0` → `v2.0.0`

⚠️ **Tag 必须以 `v` 开头**

---

## 🔍 查看构建状态

访问：https://github.com/Zhangyuc2025/video-toolbox/actions

- ✅ 绿色勾：构建成功
- ❌ 红色叉：构建失败（点击查看日志）
- 🟡 黄色圈：正在构建中

---

## 🧪 测试更新功能

1. 安装旧版本应用（例如 v1.0.2）
2. 发布新版本（例如 v1.0.3）
3. 打开旧版本应用，点击"检查更新"
4. 应用会自动检测并提示更新

---

## 🛠️ 本地测试构建

如果需要本地测试打包（不发布）：

```bash
# 运行本地构建脚本
cd scripts
./release.bat

# 或者直接使用 Tauri CLI
pnpm tauri:build
```

---

## ⚙️ 技术细节

### 自动化流程

1. 推送 tag（`v*.*.*` 格式）
2. 触发 GitHub Actions workflow
3. 安装依赖（Node.js, Rust, pnpm）
4. 编译应用
5. 使用密钥签名
6. 创建 GitHub Release
7. 上传安装包和更新包
8. 自动生成 `latest.json` 更新清单

### 密钥管理

密钥已安全存储在 GitHub Secrets：
- `TAURI_PRIVATE_KEY` - 签名私钥
- `TAURI_KEY_PASSWORD` - 密钥密码

### 更新检测

应用启动时自动检查更新：
- Endpoint: `https://github.com/Zhangyuc2025/video-toolbox/releases/latest/download/latest.json`
- 使用公钥验证签名
- 下载增量更新包（`.nsis.zip`）

---

## 📝 工作流对比

### 旧方式（手动）
1. ❌ 本地运行 `release.bat`
2. ❌ 手动创建 GitHub Release
3. ❌ 手动上传 3 个文件
4. ❌ 运行 `upload-update-interactive.bat`
5. ❌ 粘贴 GitHub URL

### 新方式（自动）
1. ✅ `git tag v1.0.x && git push --tags`
2. ✅ 完成！

---

## 🎉 完成

现在您可以专注于开发，发布完全自动化！
