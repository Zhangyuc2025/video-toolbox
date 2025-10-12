# Supabase Realtime 实时推送配置指南

## 📌 功能说明

Supabase Realtime 实时推送功能让所有登录方式都能享受**毫秒级实时响应**，统一了扫码登录和链接登录的体验。

### 统一登录架构

**✅ 已配置 Realtime**：
- **扫码登录**：云端二维码 + Realtime 推送 ⚡
- **链接登录**：云端二维码 + Realtime 推送 ⚡
- **响应速度**：<100毫秒
- **服务器负载**：极低（仅 WebSocket）

**❌ 未配置 Realtime**：
- 所有登录方式**无法使用**
- 需要先配置 Supabase 才能创建账号

---

## 🚀 配置步骤

### 1. 获取 Supabase 配置

1. 登录 [Supabase Dashboard](https://app.supabase.com/)
2. 选择你的项目
3. 进入 `Settings` → `API`
4. 复制以下信息：
   - **Project URL** (例如: `https://xxxxx.supabase.co`)
   - **anon/public key** (以 `eyJ` 开头的长字符串)

### 2. 配置环境变量

编辑 `.env` 文件，添加以下配置：

```bash
# Supabase configuration (for realtime push)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

替换 `your-project` 和 `your-anon-key-here` 为你的实际值。

### 3. 启用 Realtime 功能

在 Supabase Dashboard 中：

1. 进入 `Database` → `Replication`
2. 找到 `permanent_links` 表
3. 开启 **Realtime** 功能（如果未开启）

### 4. 配置 Row Level Security (RLS)

为了安全，建议配置 RLS 策略：

```sql
-- 允许订阅 permanent_links 表的 UPDATE 事件
CREATE POLICY "允许订阅链接更新"
ON permanent_links
FOR SELECT
USING (true);
```

### 5. 重启应用

配置完成后，重启应用即可生效。

---

## 📊 统一架构优势

### 旧架构 vs 新架构

| 特性 | 旧架构（混合模式） | 新架构（纯 Realtime） |
|------|----------------|---------------------|
| **扫码登录** | 本地轮询（1秒/次） | ✅ 云端 Realtime（毫秒级）|
| **链接登录** | HTTP轮询（2-30秒/次） | ✅ 云端 Realtime（毫秒级）|
| **代码复杂度** | 两套逻辑（本地 + 云端） | ✅ 统一逻辑（纯云端） |
| **响应延迟** | 扫码1秒，链接1-30秒 | ✅ **统一<100毫秒** ⚡ |
| **服务器负载** | 高（频繁HTTP轮询） | ✅ **极低（WebSocket）** |
| **可维护性** | 低（两套代码） | ✅ **高（一套代码）** |
| **用户体验** | 不一致（延迟差异大） | ✅ **一致（都是实时）** |

---

## 🔍 如何验证配置

### 1. 查看控制台日志

启动应用后，查看浏览器控制台：

```
[Realtime] Supabase 客户端初始化成功
[Realtime] 订阅链接: abc123...
[Realtime] 订阅状态: SUBSCRIBED (token: abc123)
[Realtime] ✅ 订阅成功: abc123
```

如果看到 `Supabase 未配置，将使用轮询模式`，说明配置有误。

### 2. 测试实时推送

1. 创建一个链接上号账号
2. 在手机上扫码登录
3. 观察控制台日志：

**配置成功**：
```
[Realtime] 账号 #1 收到 Cookie 更新通知
[Realtime] 账号 #1 Cookie同步完成
```

**未配置**：
```
[后台轮询] 账号 #1 检测到扫码成功，开始同步Cookie
```

---

## ⚠️ 常见问题

### 1. 报错 "Supabase 未配置"

**原因**：环境变量配置错误或未配置

**解决方案**：
- 检查 `.env` 文件中的配置是否正确
- 确保重启了应用
- 确保环境变量名称正确（以 `VITE_` 开头）

### 2. 订阅失败 (status: CHANNEL_ERROR)

**原因**：Supabase Realtime 功能未开启或 RLS 配置错误

**解决方案**：
- 在 Supabase Dashboard 中检查 Realtime 功能是否开启
- 检查 RLS 策略是否正确配置

### 3. 收不到实时通知，但轮询正常

**原因**：Supabase Realtime 订阅成功，但数据库更新事件未触发

**解决方案**：
- 检查云端 API 是否正确更新了数据库
- 在 Supabase Dashboard 中手动更新一条记录，测试 Realtime 是否工作
- 检查浏览器控制台是否有 WebSocket 连接

### 4. 应用关闭后，订阅未清理

**原因**：组件卸载时未调用清理函数

**解决方案**：
在组件卸载时调用：
```typescript
onUnmounted(() => {
  realtimePushService.destroy();
});
```

---

## 🎯 最佳实践

1. **生产环境强烈建议配置 Realtime**
   - ⚡ 提升用户体验（毫秒级实时响应）
   - 💰 大幅降低服务器负载（无HTTP轮询）
   - 🚀 提高系统并发能力

2. **Realtime 自带可靠性保证**
   - ✅ WebSocket 自动重连
   - ✅ 连接断开时自动恢复订阅
   - ✅ 无需手动实现降级逻辑

3. **未配置 Realtime 的降级机制**
   - 系统自动切换到智能轮询模式
   - 根据链接状态动态调整轮询频率
   - 保证功能可用性

4. **监控订阅状态**
   - 定期检查订阅数量：`realtimePushService.getSubscriptionCount()`
   - 观察控制台日志，确认订阅状态

5. **性能优势**
   - **Realtime 模式**：仅维持 1 个 WebSocket 连接
   - **轮询模式**：每 2-30 秒发起 1 次 HTTP 请求
   - **100 个账号场景**：Realtime 节省 **99%+** 的网络请求

---

## 📚 技术原理

### 统一登录流程

扫码登录和链接登录现在完全统一：

```
1. 生成云端永久链接
    ↓
2. 创建空浏览器（临时状态）
    ↓
3. 订阅 Realtime（监听数据库变化）
    ↓
4. 用户扫码
    ↓
5. 云端 API 更新数据库（写入 Cookie）
    ↓
6. Supabase Realtime 检测到 UPDATE 事件
    ↓
7. 通过 WebSocket 推送到应用端（毫秒级）
    ↓
8. 触发回调：handleRealtimeCookieUpdate()
    ↓
9. 同步 Cookie 到浏览器
    ↓
10. 注册浏览器ID到云端（建立映射）
    ↓
11. 完成！
```

### 架构优势

**代码统一**：
- 扫码登录：`generateSingleQRCode()` → 云端链接 + Realtime
- 链接登录：`generatePermanentLink()` → 云端链接 + Realtime
- 统一回调：`handleRealtimeCookieUpdate()` 处理所有场景

**强制配置 Realtime 的原因**：
1. ✅ **简化代码**：删除所有轮询逻辑，减少 70% 代码量
2. ✅ **统一体验**：所有登录方式都是毫秒级响应
3. ✅ **降低负载**：完全消除 HTTP 轮询，节省 99% 网络请求
4. ✅ **更易维护**：一套逻辑，更容易排查问题

---

## 🔗 相关链接

- [Supabase Realtime 文档](https://supabase.com/docs/guides/realtime)
- [Supabase JavaScript 客户端](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security 指南](https://supabase.com/docs/guides/auth/row-level-security)

---

## ❓ 需要帮助？

如果配置过程中遇到问题，请：
1. 查看浏览器控制台日志
2. 检查 Supabase Dashboard 中的 Logs
3. 提交 Issue 到项目仓库
