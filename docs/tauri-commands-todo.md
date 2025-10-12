# Tauri 后端命令待实现

## 账号管理相关命令

### 1. `generate_login_qr`
生成登录二维码

**参数：**
```rust
#[tauri::command]
async fn generate_login_qr(login_method: String) -> Result<QRResponse, String>
```

**返回：**
```typescript
{
  qrUrl: string;      // 二维码图片 URL (data:image/png;base64,...)
  expireTime: number; // 过期时间戳
}
```

**实现要点：**
- 根据 login_method 参数生成对应的二维码
  - `channels_helper`: 视频号助手登录（不支持长按扫码）
  - `shop_helper`: 微信小店带货助手登录（支持长按扫码）
- 返回 base64 编码的图片或图片URL
- 设置过期时间（通常2分钟）


### 2. `check_qr_status`
检查二维码扫描状态

**参数：**
```rust
#[tauri::command]
async fn check_qr_status(
    login_method: String,
    qr_url: String
) -> Result<QRLoginResult, String>
```

**返回：**
```typescript
{
  success: boolean;
  scanned: boolean;   // 是否已扫码
  expired: boolean;   // 是否已过期
  cookie?: string;    // 登录成功后的 Cookie
  nickname?: string;  // 用户昵称
  avatar?: string;    // 用户头像 URL
  message?: string;   // 错误或状态消息
}
```

**实现要点：**
- 轮询检查二维码状态
- 区分状态：未扫码、已扫码待确认、已确认、已过期、已取消
- 成功后返回 Cookie 和用户信息


### 3. `create_browser_with_account`
使用账号信息创建浏览器

**参数：**
```rust
#[tauri::command]
async fn create_browser_with_account(
    config: AccountConfig,
    cookie: String,
    nickname: Option<String>
) -> Result<CreateBrowserResult, String>

// AccountConfig 结构
// 注：统一使用二维码登录方式
struct AccountConfig {
    login_method: String,  // 登录方式：channels_helper 或 shop_helper
    proxy: Option<ProxyConfig>,
    group_id: Option<String>,
    group_name: Option<String>,
    remark: Option<String>,
}

struct ProxyConfig {
    proxy_type: String,
    host: String,
    port: u16,
    username: Option<String>,
    password: Option<String>,
}
```

**返回：**
```typescript
{
  success: boolean;
  browserId?: string;
  message?: string;
}
```

**实现要点：**
1. 验证 Cookie 有效性
2. 获取账号详细信息（昵称、头像等）
3. 调用 BitBrowser API 创建浏览器窗口
   - 设置浏览器名称为账号昵称
   - 配置代理（如果提供）
   - 设置分组
   - 注入 Cookie
4. 保存浏览器配置到本地
5. 返回浏览器ID


## 实现优先级

1. ✅ **高优先级** - `generate_login_qr`
   - 基础功能，必须先实现

2. ✅ **高优先级** - `check_qr_status`
   - 配合二维码生成使用

3. ✅ **高优先级** - `create_browser_with_account`
   - 完成账号创建流程

## 参考已有命令

可以参考项目中已有的命令实现：
- `src-tauri/src/commands/bitbrowser.rs` - BitBrowser API 调用
- `src-tauri/src/commands/browser.rs` - 浏览器操作

## 扩展性设计

### 支持多种登录方式

```rust
enum LoginMethod {
    ChannelsHelper,  // 视频号助手（不支持长按扫码）
    ShopHelper,      // 微信小店带货助手（支持长按扫码）
    // 后续可添加其他登录方式
}

impl LoginMethod {
    fn generate_qr(&self) -> Result<QRResponse, String> {
        match self {
            LoginMethod::ChannelsHelper => self.channels_helper_qr(),
            LoginMethod::ShopHelper => self.shop_helper_qr(),
        }
    }
}
```

### 统一二维码登录

所有登录方式统一使用二维码登录方式，简化实现和用户体验。

## 测试建议

1. 先实现视频号助手的二维码登录流程
2. 使用 mock 数据测试前端 UI
3. 逐步替换为真实 API 调用
4. 实现微信小店带货助手的登录流程（支持长按扫码）
5. 添加错误处理和重试机制

## 注意事项

- 二维码过期时间通常为 2-3 分钟
- 轮询间隔建议 2 秒
- Cookie 有效期检查
- 代理连接超时处理
- 并发创建多个浏览器时的限流
