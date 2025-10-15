# 视频号永久链接助手 - 浏览器插件

## 功能说明

这是一个Chrome/Edge浏览器插件，用于自动上传视频号Cookie到云端。

### 当前版本（v1.0.0 - 雏形）

- ✅ 基础文件结构
- ✅ Manifest V3配置
- ✅ Background Service Worker
- ✅ Content Script注入
- ✅ Popup用户界面
- ⏳ Cookie自动检测（待完善）
- ⏳ 自动上传功能（待完善）
- ⏳ 小店转视频号（待实现）

## 文件结构

```
browser-extension/
├── manifest.json       # 插件清单文件
├── background.js       # 后台服务脚本
├── content.js         # 内容脚本（注入到页面）
├── popup.html         # 弹出窗口UI
├── popup.js           # 弹出窗口逻辑
├── icons/             # 图标文件夹
│   ├── icon16.png     # 16x16 图标（待添加）
│   ├── icon48.png     # 48x48 图标（待添加）
│   └── icon128.png    # 128x128 图标（待添加）
└── README.md          # 说明文档
```

## 配置方式

插件需要配置`browserId`才能正常工作。配置通过以下方式：

### 方式1：通过Toolbox自动配置（推荐）

Toolbox会在创建/更新浏览器时自动配置插件，并写入browserId到`chrome.storage.local`。

### 方式2：手动配置

在浏览器中打开开发者工具，执行：

```javascript
chrome.storage.local.set({
  browserId: 'your-browser-id-here',
  apiEndpoint: 'https://jsfjdcbfftuaynwkmjey.supabase.co/functions/v1/update-channels-cookie'
});
```

## 工作流程

1. **检测登录**：监听标签页，检测用户访问视频号或小店页面
2. **提取Cookie**：从浏览器Cookie中提取`sessionid`和`wxuin`
3. **上传云端**：通过Supabase Function上传到数据库
4. **实时推送**：云端更新后通过Realtime推送给Toolbox
5. **自动同步**：Toolbox收到推送后自动同步到BitBrowser

## API接口

插件使用以下API端点：

- **上传Cookie**: `POST /functions/v1/update-channels-cookie`
  ```json
  {
    "browser_id": "xxx",
    "sessionid": "xxx",
    "wxuin": "xxx"
  }
  ```

## 开发说明

### 本地测试

1. 打开Chrome/Edge浏览器
2. 进入扩展程序管理页面（chrome://extensions/）
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择`browser-extension`文件夹

### 调试

- **Background日志**: 在扩展程序管理页面点击"Service Worker"
- **Content Script日志**: 在目标页面F12开发者工具的Console中查看
- **Popup日志**: 右键点击插件图标 → 检查弹出内容

## 权限说明

- `cookies`: 读取浏览器Cookie
- `storage`: 存储插件配置
- `tabs`: 监听标签页状态
- `host_permissions`: 访问微信域名下的资源

## 注意事项

1. ⚠️ 图标文件尚未添加，需要准备16x16、48x48、128x128三种尺寸
2. ⚠️ 当前为雏形版本，核心功能待完善
3. ⚠️ 需要配置browserId后才能正常工作

## 后续开发计划

- [ ] 完善Cookie自动检测逻辑
- [ ] 实现自动上传功能
- [ ] 添加小店助手转视频号功能
- [ ] 添加用户反馈提示
- [ ] 添加错误重试机制
- [ ] 优化性能和稳定性

## 集成到Toolbox

Toolbox需要实现以下功能来支持插件：

1. **打包插件**: 将插件文件打包为zip或直接复制到指定目录
2. **配置插件**: 创建浏览器时通过BitBrowser API配置插件
3. **写入配置**: 将browserId写入到插件的chrome.storage
4. **检查状态**: 检查现有浏览器是否已安装插件

具体实现见Toolbox的`plugin-manager.ts`。
