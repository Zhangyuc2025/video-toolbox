# Tauri 应用热更新完整指南

本指南将帮助你为视频号工具箱配置完整的热更新功能，基于 Cloudflare Workers + R2 存储。

## 📋 目录

1. [系统架构](#系统架构)
2. [前置准备](#前置准备)
3. [步骤一：生成签名密钥](#步骤一生成签名密钥)
4. [步骤二：配置 Cloudflare R2](#步骤二配置-cloudflare-r2)
5. [步骤三：部署更新服务](#步骤三部署更新服务)
6. [步骤四：打包和发布](#步骤四打包和发布)
7. [步骤五：前端集成](#步骤五前端集成)
8. [常见问题](#常见问题)

---

## 系统架构

```
┌─────────────────┐
│  Tauri 应用      │
│  (客户端)        │
└────────┬────────┘
         │ 检查更新
         ↓
┌─────────────────────────────┐
│  Cloudflare Workers         │
│  api.quanyuge.cloud         │
│  /api/updater/check         │
└────────┬────────────────────┘
         │ 读取版本信息
         ↓
┌─────────────────────────────┐
│  Cloudflare R2 存储         │
│  - latest.json (版本信息)   │
│  - app.msi (安装包)         │
│  - app.msi.sig (签名)       │
└─────────────────────────────┘
```

---

## 前置准备

### 必需工具

- [x] Node.js >= 20.19.0
- [x] Rust + Cargo
- [x] Tauri CLI
- [x] Cloudflare 账号

### 安装 Tauri CLI

```bash
# 使用 Cargo 安装（推荐）
cargo install tauri-cli

# 或使用 npm
npm install -g @tauri-apps/cli
```

---

## 步骤一：生成签名密钥

热更新需要使用非对称加密来验证更新包的安全性。

### 1.1 运行密钥生成脚本

```bash
cd toolbox
node scripts/generate-update-key.js
```

### 1.2 保存密钥信息

脚本会自动：
1. 生成密钥对存储在 `~/.tauri/videotoolbox.key`
2. 更新 `src-tauri/tauri.conf.json` 中的 `pubkey` 配置
3. 显示公钥内容

**重要：**
- ✅ 公钥会自动配置到项目中
- ⚠️ 私钥 `~/.tauri/videotoolbox.key` **必须妥善保管**
- ⚠️ 不要将私钥提交到 Git 仓库
- ⚠️ 打包时需要使用相同的私钥

---

## 步骤二：配置 Cloudflare R2

### 2.1 创建 R2 存储桶

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **R2 Object Storage**
3. 点击 **Create bucket**
4. 桶名称：`tauri-app-updates`
5. 地区：选择离用户最近的地区

### 2.2 配置存储桶

在 `permanent-link-service-workers/wrangler.toml` 中启用 R2：

```toml
# 取消注释以下配置
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "tauri-app-updates"
```

### 2.3 设置管理员令牌

```bash
cd permanent-link-service-workers

# 设置管理员令牌（用于上传更新包）
wrangler secret put ADMIN_TOKEN
# 输入一个强密码，例如：your-secure-admin-token-2024
```

---

## 步骤三：部署更新服务

### 3.1 部署到 Cloudflare

```bash
cd permanent-link-service-workers

# 部署 Workers
pnpm deploy
# 或使用 npm
npm run deploy
```

### 3.2 验证部署

访问以下地址检查服务是否正常：

```
https://api.quanyuge.cloud/api/updater/check/windows-x86_64/1.0.0
```

应该返回：
```json
{
  "success": false,
  "error": "暂无可用更新"
}
```

这是正常的，因为我们还没有上传任何更新包。

---

## 步骤四：打包和发布

### 4.1 首次打包

```bash
cd toolbox

# 确保已安装依赖
pnpm install

# 构建生产版本
pnpm tauri:build
```

打包完成后，会在 `src-tauri/target/release/bundle` 目录生成：

- **Windows**:
  - `视频号工具箱_1.0.0_x64_en-US.msi`
  - `视频号工具箱_1.0.0_x64_en-US.msi.zip`
  - `视频号工具箱_1.0.0_x64_en-US.msi.zip.sig` ← **签名文件**

- **macOS**:
  - `视频号工具箱.app.tar.gz`
  - `视频号工具箱.app.tar.gz.sig`

### 4.2 上传到 R2 存储桶

使用 Wrangler CLI 上传：

```bash
# 上传安装包
wrangler r2 object put tauri-app-updates/releases/windows-x86_64/1.0.1/app.msi \
  --file="src-tauri/target/release/bundle/msi/视频号工具箱_1.0.1_x64.msi"

# 上传签名文件
wrangler r2 object put tauri-app-updates/releases/windows-x86_64/1.0.1/app.msi.sig \
  --file="src-tauri/target/release/bundle/msi/视频号工具箱_1.0.1_x64.msi.sig"
```

或使用 Cloudflare Dashboard 手动上传。

### 4.3 上传版本信息

创建版本清单文件 `update-manifest.json`：

```json
{
  "version": "1.0.1",
  "notes": "修复了登录问题\n新增批量操作功能\n优化了界面性能",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkK...",
      "url": "https://pub-xxxxx.r2.dev/releases/windows-x86_64/1.0.1/app.msi"
    }
  }
}
```

**获取签名内容：**

```bash
# Windows
type "src-tauri\target\release\bundle\msi\视频号工具箱_1.0.1_x64.msi.sig"

# macOS/Linux
cat "src-tauri/target/release/bundle/msi/视频号工具箱_1.0.1_x64.msi.sig"
```

**上传版本信息：**

```bash
# 使用管理员 API 上传
curl -X POST https://api.quanyuge.cloud/api/updater/upload \
  -H "Authorization: Bearer your-secure-admin-token-2024" \
  -H "Content-Type: application/json" \
  -d @update-manifest.json
```

---

## 步骤五：前端集成

### 5.1 在应用启动时检查更新

编辑 `src/App.vue` 或主入口文件：

```typescript
import { onMounted } from 'vue';
import { silentCheckUpdate } from '@/utils/updater';

onMounted(async () => {
  // 静默检查更新（不打扰用户）
  await silentCheckUpdate();
});
```

### 5.2 添加手动检查更新按钮

在设置页面或菜单中添加：

```vue
<template>
  <NButton @click="handleCheckUpdate" :loading="checking">
    检查更新
  </NButton>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { checkForUpdates, performUpdate } from '@/utils/updater';
import { useMessage } from 'naive-ui';

const message = useMessage();
const checking = ref(false);

async function handleCheckUpdate() {
  checking.value = true;
  try {
    const updateInfo = await checkForUpdates();

    if (updateInfo.available) {
      // 执行更新流程
      await performUpdate((progress, msg) => {
        console.log(`${progress}% - ${msg}`);
      });
    } else {
      message.success('当前已是最新版本');
    }
  } catch (error: any) {
    message.error(error.message);
  } finally {
    checking.value = false;
  }
}
</script>
```

### 5.3 显示版本号

```vue
<template>
  <div>当前版本：{{ version }}</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getCurrentVersion } from '@/utils/updater';

const version = ref('1.0.0');

onMounted(async () => {
  version.value = await getCurrentVersion();
});
</script>
```

---

## 常见问题

### Q1: 更新检查失败，提示签名验证错误

**原因：** 公钥和私钥不匹配

**解决：**
1. 确保打包时使用的私钥与 `tauri.conf.json` 中的公钥对应
2. 重新运行 `node scripts/generate-update-key.js`
3. 重新打包应用

### Q2: 如何支持多平台？

在 `update-manifest.json` 中添加多个平台：

```json
{
  "platforms": {
    "windows-x86_64": { ... },
    "darwin-x86_64": { ... },
    "darwin-aarch64": { ... },
    "linux-x86_64": { ... }
  }
}
```

### Q3: 如何回滚版本？

修改 Workers 中的 `updater.ts`，返回旧版本的清单信息。

### Q4: 如何测试更新功能？

1. 打包版本 `1.0.0` 并安装
2. 修改版本号为 `1.0.1` 并重新打包
3. 上传 `1.0.1` 的安装包和签名
4. 在 `1.0.0` 应用中点击"检查更新"

### Q5: R2 存储费用如何？

Cloudflare R2 定价：
- 存储：$0.015/GB/月
- 下载：免费（无出站费用）
- 操作：$0.36/百万次写入，$0.036/百万次读取

对于小型应用，费用基本可以忽略不计。

---

## 更新流程总结

```
1. 修改代码 → 2. 更新版本号 → 3. 打包应用
                      ↓
4. 上传到 R2 ← 5. 创建清单 ← 6. 获取签名
                      ↓
7. 上传清单到 Workers ← 8. 用户检查更新 → 9. 自动下载安装
```

---

## 进阶功能

### 自动化发布

可以使用 GitHub Actions 自动化打包和发布流程，参考 `.github/workflows/release.yml`。

### 增量更新

Tauri 支持增量更新以节省流量，需要在 `tauri.conf.json` 中配置。

### 更新统计

在 Workers 中添加统计逻辑，记录更新次数和成功率。

---

## 相关链接

- [Tauri 更新文档](https://tauri.app/v1/guides/distribution/updater)
- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)

---

**完成！**
现在你的应用已经具备完整的热更新功能。用户无需重新下载安装包，即可自动获取最新版本。
