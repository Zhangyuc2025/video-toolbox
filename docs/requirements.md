# 视频号工具箱 - 功能需求文档

> 基于 Tauri + Vue3 + NaiveUI 架构的视频号账号管理工具

**版本**：v2.0
**更新日期**：2025-10-09
**技术栈**：Tauri 1.5 + Vue 3.5 + TypeScript 5.9 + NaiveUI 2.43 + Pinia 3.0

---

## 📋 目录

1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [功能模块](#功能模块)
4. [数据模型](#数据模型)
5. [API接口](#api接口)
6. [UI设计规范](#ui设计规范)

---

## 项目概述

### 项目定位
视频号工具箱是一款基于比特浏览器的多账号管理工具，主要用于：
- 批量管理微信视频号账号
- 自动维护账号登录状态（Cookie保活）
- 提供账号操作的可视化界面

### 核心价值
- **批量管理**：支持100+账号同时管理
- **自动保活**：智能检测并自动续期Cookie，保持账号在线
- **安全隔离**：基于比特浏览器，每个账号独立环境
- **高效操作**：批量操作、并发控制、速率限制

### 目标用户
- 视频号运营人员
- 多账号管理需求的用户
- 需要自动化操作的开发者

---

## 技术架构

### 前端架构
```
Tauri (Rust) - 桌面应用框架
├── Vue 3 - 渐进式JavaScript框架
│   ├── Composition API - 组合式API
│   ├── TypeScript - 类型安全
│   └── Vite - 构建工具
├── NaiveUI - UI组件库
│   ├── 主题定制
│   └── 组件封装
├── Pinia - 状态管理
│   ├── Config Store - 配置状态
│   ├── Browser Store - 浏览器状态
│   └── Cookie Store - Cookie状态
└── Vue Router - 路由管理
```

### 后端架构
```
Tauri Command (Rust ↔ Python)
├── Python脚本层
│   ├── bitbrowser_api.py - 比特浏览器API
│   ├── channels_api.py - 视频号API
│   ├── wechat_store_api.py - 微信小店API
│   └── heating_platform_api.py - 加热平台API
└── Rust Command层
    ├── 进程管理
    ├── 文件系统操作
    └── 系统调用
```

### 数据存储
```
Tauri Store (.settings.dat) - 配置和Cookie
├── 自动加密
├── 跨平台兼容
└── Reactive更新

SQLite (可选) - 统计和日志
├── 检测历史
├── 在线统计
└── 操作日志
```

---

## 功能模块

### 1. 首页 - 状态监控 🏠

#### 1.1 比特浏览器状态检测
- **功能描述**：实时检测比特浏览器运行状态
- **检测项**：
  - 进程是否运行
  - API端口是否可访问 (127.0.0.1:54345)
  - API响应时间
- **显示信息**：
  - 运行状态：运行中 / 未运行
  - 连接状态：已连接 / 未连接 / 连接失败
  - 状态指示灯：绿色(正常) / 黄色(警告) / 红色(错误)

#### 1.2 快速启动控制
- **启动比特浏览器**
  - 读取配置的浏览器路径
  - 调用系统命令启动
  - 等待API就绪
- **重启比特浏览器**
  - 关闭现有进程
  - 重新启动
  - 自动重连

#### 1.3 系统信息面板
- 已管理账号数量
- Cookie有效账号数 / 总数
- 正在运行的浏览器数量
- 今日Cookie续期次数

#### 1.4 快捷操作
- 批量启动账号
- 批量检测Cookie
- 跳转到账号管理页

---

### 2. 账号管理 👥

#### 2.1 账号列表展示

##### 布局方式
- **卡片网格布局**
  - 响应式设计，自适应列数
  - 卡片宽度：360px
  - 卡片间距：16px
  - 支持虚拟滚动（大量账号时）

##### 卡片信息展示
```
┌─────────────────────────────────────┐
│ 🟢 账号状态                          │
│ ┌───────┐                            │
│ │ 头像  │ 昵称：张三                  │
│ │       │ ID：b8d5f2...               │
│ └───────┘ 备注：测试账号01            │
│                                      │
│ 🍪 Cookie状态                        │
│ ├─ 有效期：2025-10-10 15:30         │
│ ├─ 已在线：2小时15分                │
│ └─ 续期次数：3次                    │
│                                      │
│ 🌐 代理：SOCKS5 (127.0.0.1:1080)    │
│                                      │
│ [启动] [检测] [登录] [详情] [⋮]     │
└─────────────────────────────────────┘
```

##### 状态标识
- **账号状态**：
  - 🟢 在线（Cookie有效）
  - 🟡 即将过期（15分钟内）
  - 🔴 已失效
  - ⚪ 未登录
- **浏览器状态**：
  - ▶️ 运行中
  - ⏸️ 已关闭

#### 2.2 账号操作

##### 基础操作
- **启动浏览器**
  - 调用比特浏览器API打开指定账号
  - 自动应用代理配置
  - 自动同步Cookie（如果已保存）
- **关闭浏览器**
  - 关闭浏览器窗口
  - 不清除Cookie
- **删除账号**
  - 二次确认对话框
  - 同时删除Cookie缓存
  - 删除代理配置

##### 批量操作
- **批量选择**
  - 全选 / 反选
  - 按状态筛选（有效 / 失效 / 未登录）
  - 按创建者筛选（只看我的）
- **批量启动**
  - 串行启动，间隔2秒
  - 显示启动进度
- **批量检测Cookie**
  - 并发检测（最大5并发）
  - 显示检测进度
  - 显示成功/失败数量

#### 2.3 代理配置

##### 代理类型
- HTTP
- HTTPS
- SOCKS5

##### 配置项
```typescript
interface ProxyConfig {
  type: 'http' | 'https' | 'socks5'
  host: string        // 代理主机
  port: number        // 代理端口
  username?: string   // 用户名（可选）
  password?: string   // 密码（可选）
}
```

##### 代理管理
- **设置代理**：为单个账号配置代理
- **批量设置**：为选中账号批量配置代理
- **代理测试**：测试代理是否可用
- **清除代理**：移除代理配置

#### 2.4 账号过滤和搜索

##### 过滤条件
- **状态过滤**
  - 全部
  - 在线（Cookie有效）
  - 已失效
  - 未登录
  - 运行中
- **创建者过滤**
  - 全部账号
  - 只看我的（根据配置的用户名）
- **代理过滤**
  - 已配置代理
  - 未配置代理

##### 搜索功能
- 按昵称搜索
- 按备注搜索
- 按浏览器ID搜索
- 实时搜索（防抖500ms）

#### 2.5 排序功能
- 按创建时间（默认）
- 按在线时长
- 按Cookie过期时间
- 按续期次数

---

### 3. 微信扫码登录 📱

#### 3.1 登录流程

```
用户点击"扫码登录"
    ↓
生成二维码（60秒有效期）
    ↓
轮询检测扫码状态（2秒/次）
    ├─ 等待扫码
    ├─ 已扫码待确认
    ├─ 登录成功 → 获取Cookie
    ├─ 二维码过期 → 提示刷新
    └─ 用户取消 → 关闭对话框
    ↓
Cookie同步到比特浏览器
    ↓
保存到配置文件
    ↓
更新账号卡片状态
```

#### 3.2 二维码对话框

##### 布局
```
┌─────────────────────────────────┐
│        微信视频号登录            │
├─────────────────────────────────┤
│                                 │
│         ┌──────────┐            │
│         │          │            │
│         │  二维码  │            │
│         │          │            │
│         └──────────┘            │
│                                 │
│   请使用微信扫描二维码登录       │
│   剩余时间：45秒                │
│                                 │
│   状态：⏳ 等待扫码...          │
│                                 │
│      [刷新二维码] [取消]        │
└─────────────────────────────────┘
```

##### 状态提示
- ⏳ 等待扫码...
- 📱 已扫码，请在手机上确认
- ✅ 登录成功！正在同步Cookie...
- ⚠️ 二维码已过期，请刷新
- ❌ 登录失败：[错误信息]

#### 3.3 Cookie同步

##### 同步流程
1. 获取登录后的Cookie列表
2. 解析Cookie为比特浏览器格式
3. 调用比特浏览器API更新Cookie
4. 保存到本地配置
5. 更新账号信息（昵称、头像）

##### Cookie格式
```typescript
interface CookieData {
  cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    expires?: number
    httpOnly?: boolean
    secure?: boolean
  }>
  expiresTime?: string      // GMT格式过期时间
  accountInfo: {
    nickname: string        // 昵称
    headImgUrl: string      // 头像URL
    finderUsername?: string // 视频号用户名
  }
  updatedAt: string         // 更新时间
  loginTime: number         // 登录时间戳
}
```

#### 3.4 登录选项
- **代理设置**：使用账号配置的代理进行登录
- **自动检测**：登录成功后自动检测Cookie有效性
- **同步到浏览器**：是否立即同步Cookie到比特浏览器

---

### 4. Cookie智能检测 🔍

#### 4.1 检测方式

##### 手动检测
- **单个检测**：点击账号卡片的"检测"按钮
- **批量检测**：选中多个账号后批量检测
- **全部检测**：一键检测所有账号

##### 自动检测（保活服务）
- 后台定时检测
- 智能调度（根据过期时间优先级）
- 并发控制（最大5并发）

#### 4.2 检测流程

```
开始检测
    ↓
获取代理配置
    ↓
速率限制（会员8次/秒，普通2次/秒）
    ↓
调用视频号API验证Cookie
    ├─ /cgi-bin/mmfinderassistant-bin/helper/helper_upload_params
    └─ 读取响应中的Set-Cookie
    ↓
解析Cookie过期时间
    ↓
更新账号信息（昵称、头像）
    ↓
保存到配置文件
    ↓
更新UI状态
```

#### 4.3 检测状态

##### 卡片内状态
- **检测中**
  - 显示加载动画
  - 按钮变为"检测中..."并禁用
  - 状态文字：🔄 检测中...
- **检测成功**
  - 绿色图标
  - 显示过期时间
  - 更新在线时长
- **检测失败**
  - 红色图标
  - 显示失败原因
  - 建议操作：重新登录

##### 批量检测进度
```
┌─────────────────────────────────┐
│      批量检测Cookie              │
├─────────────────────────────────┤
│  ████████████░░░░░░  67%        │
│  已完成：20 / 30                 │
│  成功：18  失败：2               │
│                                 │
│  正在检测：账号A、账号B...       │
│                                 │
│         [停止检测] [关闭]        │
└─────────────────────────────────┘
```

#### 4.4 检测结果处理

##### 成功情况
- 更新Cookie过期时间
- 更新账号信息（如果有变化）
- 记录续期次数
- 更新最后检测时间

##### 失败情况
- 标记Cookie失效
- 记录失效时间（用于计算在线时长）
- 发送桌面通知（可选）
- 记录到检测日志

#### 4.5 在线时长统计

##### 计算规则
- **登录时间**：首次登录或重新登录时记录
- **失效时间**：检测到Cookie失效时记录
- **在线时长**：失效时间 - 登录时间

##### 显示格式
- 1分钟以内：已在线1分钟
- 1小时以内：已在线XX分钟
- 1小时以上：已在线XX小时
- 已失效：XX小时掉线

---

### 5. Cookie智能保活 🤖

#### 5.1 保活策略

##### 检测间隔
- **默认间隔**：20分钟
- **可配置范围**：5分钟 ~ 60分钟
- **智能调度**：
  - Session Cookie：每20分钟检测
  - 持久Cookie：过期前90分钟开始检测

##### 并发控制
- **最大并发数**：5（可配置）
- **速率限制**：
  - 会员模式：8请求/秒
  - 普通模式：2请求/秒
- **错误重试**：失败后间隔5分钟重试

#### 5.2 保活服务

##### 服务生命周期
```typescript
启动应用
    ↓
初始化保活服务
    ├─ 加载配置
    ├─ 创建定时器
    └─ 注册停止钩子
    ↓
5秒后执行首次检测
    ↓
定时轮询（20分钟间隔）
    ├─ 获取浏览器列表
    ├─ 过滤需要检测的账号
    ├─ 提交检测任务
    └─ 等待任务完成
    ↓
应用退出
    ↓
停止保活服务
    └─ 等待任务完成（最多5秒）
```

##### 检测优先级
1. **从未检测过的账号**：最高优先级
2. **距离上次检测超过20分钟的账号**：正常优先级
3. **其他账号**：跳过本轮检测

#### 5.3 保活日志

##### 日志类型
- **检测日志**
  - 检测时间
  - 检测结果
  - Cookie过期时间
  - 响应时间
- **续期日志**
  - 续期前过期时间
  - 续期后过期时间
  - 续期次数
- **失效日志**
  - 失效时间
  - 失效原因
  - 在线时长

##### 日志存储
- SQLite数据库（推荐）
- 或保存为JSON文件

#### 5.4 保活配置

##### 配置项
```typescript
interface KeepAliveConfig {
  enabled: boolean              // 是否启用保活
  checkInterval: number         // 检测间隔（分钟）
  maxConcurrent: number         // 最大并发数
  retryOnError: boolean         // 失败是否重试
  retryInterval: number         // 重试间隔（分钟）
  notifyOnExpire: boolean       // 失效时桌面通知
}
```

##### 用户界面
- 保活开关
- 间隔设置滑块（5 ~ 60分钟）
- 并发数设置（1 ~ 10）
- 实时状态显示

---

### 6. 设置页 ⚙️

#### 6.1 基础设置

##### 比特浏览器配置
- **安装路径**
  - 文本输入框
  - 浏览按钮（打开文件选择器）
  - 路径验证（检查exe是否存在）
- **API地址**
  - 默认：http://127.0.0.1:54345
  - 支持自定义端口

##### 配置目录
- **显示当前配置目录**
  - 路径展示
  - 打开目录按钮
  - 配置文件大小统计

#### 6.2 账号设置

##### 用户身份
- **用户名**
  - 输入框
  - 用于"只看我的账号"功能
  - 与比特浏览器的createdName匹配

##### 过滤选项
- **只看我的账号**
  - 开关按钮
  - 启用后只显示当前用户创建的账号

#### 6.3 性能设置

##### API速率
- **会员模式**
  - 开关按钮
  - 开启：8请求/秒（高速模式）
  - 关闭：2请求/秒（普通模式）
  - 说明文字：会员模式可提高API调用速度

##### Cookie保活
- **启用自动保活**：开关
- **检测间隔**：滑块（5 ~ 60分钟）
- **最大并发数**：滑块（1 ~ 10）

#### 6.4 界面设置

##### 主题配置
- **主题模式**
  - 浅色模式
  - 深色模式
  - 跟随系统
- **主题色**
  - 预设颜色选择器
  - 自定义颜色

##### 显示选项
- **卡片密度**
  - 紧凑
  - 标准（默认）
  - 宽松
- **动画效果**
  - 开启 / 关闭

#### 6.5 通知设置
- **桌面通知**
  - Cookie失效通知
  - 检测错误通知
  - 批量操作完成通知

#### 6.6 高级设置

##### 开发者选项
- **显示调试信息**
- **开启详细日志**
- **导出配置文件**
- **清除所有缓存**

##### 数据管理
- **导出账号数据**（JSON格式）
- **导入账号数据**
- **清除Cookie缓存**
- **清除检测日志**

---

### 7. IP管理 🌐

#### 7.1 代理池管理

##### 代理列表
```
┌──────────────────────────────────────────┐
│  类型    │  地址               │  状态   │
├──────────────────────────────────────────┤
│ SOCKS5  │ 127.0.0.1:1080     │  🟢 正常│
│ HTTP    │ proxy.com:8080     │  🔴 失败│
│ SOCKS5  │ 192.168.1.10:1080  │  🟡 慢  │
└──────────────────────────────────────────┘
```

##### 代理操作
- **添加代理**
  - 单个添加（表单）
  - 批量导入（文本粘贴）
  - 格式：`type://host:port:username:password`
- **编辑代理**
- **删除代理**
- **测试代理**
  - 连接测试
  - 响应时间测试

#### 7.2 代理分配

##### 分配策略
- **手动分配**：为账号选择代理
- **自动分配**：按顺序或随机分配
- **批量分配**：为选中账号批量分配

##### 分配规则
- 每个账号一个代理
- 支持多个账号共享代理
- 代理失效时自动切换

#### 7.3 代理统计

##### 统计维度
- **使用次数**：每个代理被使用的次数
- **成功率**：检测成功的比例
- **平均响应时间**：API调用的平均时间
- **最后使用时间**

##### 可视化图表
- 代理分布饼图
- 响应时间趋势图
- 成功率柱状图

---

### 8. 数据统计 📊

#### 8.1 账号统计

##### 总览面板
- **账号总数**
- **在线账号数**（Cookie有效）
- **失效账号数**
- **未登录账号数**
- **运行中浏览器数**

##### 详细统计
- **今日新增账号**
- **今日Cookie续期次数**
- **今日检测次数**
- **平均在线时长**

#### 8.2 在线时长排行

##### 排行榜
```
排名 | 账号昵称    | 在线时长  | 续期次数
-----|-----------|----------|----------
1    | 张三       | 48小时   | 12次
2    | 李四       | 36小时   | 9次
3    | 王五       | 24小时   | 6次
...
```

##### 筛选条件
- 按时间范围（今日 / 本周 / 本月 / 全部）
- 按用户（全部 / 只看我的）

#### 8.3 操作日志

##### 日志类型
- **登录日志**：扫码登录记录
- **检测日志**：Cookie检测记录
- **操作日志**：启动、关闭、删除等
- **错误日志**：API调用失败记录

##### 日志详情
```
时间：2025-10-09 15:30:25
操作：Cookie检测
账号：张三 (b8d5f2...)
结果：✅ 成功
详情：Cookie有效期延长至 2025-10-10 15:30
```

##### 日志管理
- 按类型筛选
- 按时间范围筛选
- 按账号搜索
- 导出日志（CSV / JSON）
- 清除旧日志

#### 8.4 可视化图表

##### 在线趋势图（ECharts折线图）
- X轴：时间（小时 / 天）
- Y轴：在线账号数
- 数据点：每小时的在线账号统计

##### Cookie状态分布（饼图）
- 有效（绿色）
- 即将过期（黄色）
- 已失效（红色）
- 未登录（灰色）

##### 检测成功率（柱状图）
- X轴：日期
- Y轴：成功率（%）
- 双柱对比：自动检测 vs 手动检测

---

### 9. 视频管理（预留功能）📹

#### 9.1 视频列表
- 视频标题
- 封面缩略图
- 发布时间
- 播放量 / 点赞数

#### 9.2 视频上传
- 选择视频文件
- 填写标题和描述
- 选择发布账号
- 批量上传

#### 9.3 视频编辑
- 修改标题和描述
- 更换封面
- 删除视频

---

## 数据模型

### 配置数据（Tauri Store）

```typescript
// 基础配置
interface AppConfig {
  bitbrowser_path: string          // 比特浏览器路径
  bitbrowser_api: string           // API地址
  username: string                 // 用户名
  filter_my_accounts: boolean      // 只看我的账号
  member_mode: boolean             // 会员模式
}

// Cookie保活配置
interface KeepAliveConfig {
  enabled: boolean                 // 启用保活
  check_interval: number           // 检测间隔（分钟）
  max_concurrent: number           // 最大并发
  retry_on_error: boolean          // 失败重试
  notify_on_expire: boolean        // 失效通知
}

// Cookie数据
interface BrowserCookiesMap {
  [browserId: string]: {
    cookies: Cookie[]              // Cookie列表
    expires_time?: string          // GMT格式过期时间
    account_info?: AccountInfo     // 账号信息
    renewal_count: number          // 续期次数
    updated_at: string             // 更新时间
    login_time?: number            // 登录时间戳
    expire_time?: number           // 失效时间戳
    last_check_time?: number       // 最后检测时间戳
  }
}

// Cookie格式
interface Cookie {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
}

// 账号信息
interface AccountInfo {
  nickname: string                 // 昵称
  headImgUrl: string               // 头像URL
  finderUsername?: string          // 视频号用户名
  finderNickname?: string          // 视频号昵称
  isAdmin?: boolean                // 是否管理员
}

// 代理配置
interface ProxyConfig {
  type: 'http' | 'https' | 'socks5'
  host: string
  port: number
  username?: string
  password?: string
}

// 代理列表
interface ProxyList {
  proxies: ProxyConfig[]
}
```

### 浏览器数据（来自比特浏览器API）

```typescript
// 浏览器信息
interface BrowserInfo {
  id: string                       // 浏览器ID
  name: string                     // 浏览器名称
  remark?: string                  // 备注
  proxyType?: string               // 代理类型
  host?: string                    // 代理主机
  port?: string                    // 代理端口
  proxyUserName?: string           // 代理用户名
  proxyPassword?: string           // 代理密码
  createdName?: string             // 创建者
  openUrl?: string                 // 启动URL
  fingerprint?: any                // 指纹配置
}
```

### 数据库表（SQLite，可选）

```sql
-- Cookie检测日志
CREATE TABLE cookie_check_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  browser_id TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  message TEXT,
  response_time INTEGER,          -- 响应时间（毫秒）
  check_type TEXT                 -- 检测类型：manual / auto
);

-- 在线统计
CREATE TABLE online_stats (
  browser_id TEXT PRIMARY KEY,
  total_online_seconds INTEGER DEFAULT 0,
  last_login_at DATETIME,
  last_expire_at DATETIME,
  renewal_count INTEGER DEFAULT 0
);

-- 操作日志
CREATE TABLE operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  browser_id TEXT NOT NULL,
  operation TEXT NOT NULL,        -- 操作类型：login / open / close / delete
  operator TEXT,                  -- 操作者
  operated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  details TEXT                    -- 详细信息（JSON）
);
```

---

## API接口

### Python后端API

#### 比特浏览器API（bitbrowser_api.py）

```python
# 获取浏览器列表
def get_browser_list() -> dict
# 返回: {"success": bool, "data": [BrowserInfo], "message": str}

# 打开浏览器
def open_browser(browser_id: str) -> dict
# 返回: {"success": bool, "data": {...}, "message": str}

# 关闭浏览器
def close_browser(browser_id: str) -> dict
# 返回: {"success": bool, "message": str}

# 创建浏览器
def create_browser(name: str, proxy_config: dict = None) -> dict
# 返回: {"success": bool, "data": {"id": str}, "message": str}

# 更新浏览器
def update_browser(browser_id: str, update_data: dict) -> dict
# 返回: {"success": bool, "message": str}

# 删除浏览器
def delete_browser(browser_id: str) -> dict
# 返回: {"success": bool, "message": str}

# 同步Cookie到浏览器
def sync_cookies(browser_id: str, cookies: list) -> dict
# 返回: {"success": bool, "message": str}
```

#### 视频号API（channels_api.py）

```python
# 获取登录二维码
def get_qr_code(proxy_config: dict = None) -> dict
# 返回: {"success": bool, "data": {"qr_image": bytes, "token": str}, "message": str}

# 检查扫码状态
def check_scan_status(token: str, proxy_config: dict = None) -> dict
# 返回: {"success": bool, "data": {"status": str, "cookies": list}, "message": str}

# 验证Cookie
def verify_cookie(cookies: list, proxy_config: dict = None) -> dict
# 返回: {"success": bool, "data": {"is_valid": bool, "account_info": dict, "expires_time": str}, "message": str}

# 获取账号信息
def get_account_info(cookies: list, proxy_config: dict = None) -> dict
# 返回: {"success": bool, "data": AccountInfo, "message": str}
```

### Tauri Command（Rust调用Python）

```typescript
// 调用Python脚本
invoke('execute_python', {
  script: 'bitbrowser.py',
  args: ['list']
})

// 获取浏览器列表
invoke('get_browser_list')

// 打开浏览器
invoke('open_browser', { browserId: 'xxx' })

// 关闭浏览器
invoke('close_browser', { browserId: 'xxx' })

// 获取二维码
invoke('get_qr_code', { proxyConfig: {...} })

// 验证Cookie
invoke('verify_cookie', {
  cookies: [...],
  proxyConfig: {...}
})
```

### 前端Service API

```typescript
// src/service/api/browser.ts
export const browserApi = {
  // 获取浏览器列表
  getBrowserList(): Promise<BrowserInfo[]>

  // 打开浏览器
  openBrowser(browserId: string): Promise<void>

  // 关闭浏览器
  closeBrowser(browserId: string): Promise<void>

  // 删除浏览器
  deleteBrowser(browserId: string): Promise<void>

  // 同步Cookie
  syncCookies(browserId: string, cookies: Cookie[]): Promise<void>
}

// src/service/api/wechat.ts
export const wechatApi = {
  // 获取二维码
  getQrCode(proxyConfig?: ProxyConfig): Promise<{ image: string, token: string }>

  // 检查扫码状态
  checkScanStatus(token: string): Promise<{ status: string, cookies?: Cookie[] }>

  // 验证Cookie
  verifyCookie(cookies: Cookie[], proxyConfig?: ProxyConfig): Promise<{
    isValid: boolean
    accountInfo?: AccountInfo
    expiresTime?: string
  }>
}
```

---

## UI设计规范

### 布局规范

#### 响应式断点
```
xs: < 640px   (移动设备 - 不支持)
sm: >= 640px  (小屏幕)
md: >= 768px  (平板)
lg: >= 1024px (桌面 - 标准)
xl: >= 1280px (大屏)
2xl: >= 1536px (超大屏)
```

#### 页面布局
```
┌────────────────────────────────────────┐
│  侧边栏 (240px)  │  内容区域           │
│  ─────────────  │  ─────────────────  │
│  🏠 首页        │  页面标题            │
│  👥 账号管理    │  ─────────────────  │
│  🌐 IP管理      │                     │
│  📊 数据统计    │   主要内容区         │
│  ⚙️ 设置        │                     │
│                 │                     │
│                 │  ─────────────────  │
│  [展开/收起]    │  操作区 / 分页       │
└────────────────────────────────────────┘
```

### 颜色规范

#### 主题色
```scss
// 品牌色
$primary: #18A058;        // 主色（绿色）
$primary-hover: #36AD6A;
$primary-pressed: #0C7A43;

// 信息色
$info: #2080F0;           // 蓝色
$success: #18A058;        // 绿色
$warning: #F0A020;        // 黄色
$error: #D03050;          // 红色

// 中性色
$text-primary: rgba(255, 255, 255, 0.82);
$text-secondary: rgba(255, 255, 255, 0.65);
$text-tertiary: rgba(255, 255, 255, 0.45);
$text-disabled: rgba(255, 255, 255, 0.38);
```

#### 状态色
```scss
// 账号状态
$status-online: #18A058;      // 在线（绿色）
$status-warning: #F0A020;     // 即将过期（黄色）
$status-offline: #D03050;     // 已失效（红色）
$status-unknown: #808080;     // 未登录（灰色）

// 浏览器状态
$browser-running: #2080F0;    // 运行中（蓝色）
$browser-stopped: #808080;    // 已停止（灰色）
```

### 组件规范

#### 按钮
- **主要按钮**：用于主要操作（登录、保存等）
- **次要按钮**：用于次要操作（取消、关闭等）
- **文本按钮**：用于辅助操作（查看详情等）
- **危险按钮**：用于危险操作（删除等）

#### 卡片
- **圆角**：8px
- **阴影**：`0 2px 8px rgba(0, 0, 0, 0.12)`
- **内边距**：16px
- **边框**：1px solid rgba(255, 255, 255, 0.09)

#### 表单
- **标签宽度**：120px
- **输入框高度**：40px
- **间距**：24px

#### 图标
- **大小**：16px / 20px / 24px
- **来源**：@iconify/vue
- **风格**：统一使用 Material Design Icons

### 交互规范

#### 加载状态
- **全屏加载**：使用 NLoading
- **局部加载**：使用 NSpin
- **按钮加载**：按钮变为loading状态

#### 反馈提示
- **成功**：`window.$message.success('操作成功')`
- **错误**：`window.$message.error('操作失败')`
- **警告**：`window.$message.warning('注意事项')`
- **信息**：`window.$message.info('提示信息')`

#### 确认对话框
- **危险操作**：必须二次确认
- **标题**：清晰说明操作
- **内容**：说明操作后果
- **按钮**：取消（次要） + 确定（主要/危险）

---

## 开发规范

### 目录结构

```
toolbox/
├── src/
│   ├── views/              # 页面
│   │   ├── home/           # 首页
│   │   ├── accounts/       # 账号管理
│   │   ├── data/           # 数据统计
│   │   └── settings/       # 设置
│   ├── components/         # 组件
│   │   ├── common/         # 通用组件
│   │   ├── account/        # 账号相关组件
│   │   └── dialogs/        # 对话框组件
│   ├── stores/             # 状态管理
│   │   └── modules/
│   │       ├── config.ts   # 配置状态
│   │       ├── browser.ts  # 浏览器状态
│   │       └── cookie.ts   # Cookie状态
│   ├── service/            # 服务层
│   │   ├── api/            # API调用
│   │   │   ├── browser.ts  # 浏览器API
│   │   │   └── wechat.ts   # 微信API
│   │   └── request/        # 请求封装
│   ├── utils/              # 工具函数
│   │   ├── config-store.ts # 配置存储
│   │   ├── database.ts     # 数据库
│   │   └── helpers.ts      # 辅助函数
│   ├── hooks/              # 组合式函数
│   │   ├── useBrowser.ts   # 浏览器操作
│   │   ├── useCookie.ts    # Cookie操作
│   │   └── useKeepAlive.ts # 保活服务
│   └── typings/            # 类型定义
│       ├── browser.d.ts
│       ├── cookie.d.ts
│       └── api.d.ts
├── python-backend/         # Python后端
│   ├── bitbrowser_api.py
│   ├── channels_api.py
│   └── requirements.txt
└── src-tauri/              # Tauri配置
    ├── src/
    │   └── main.rs
    └── tauri.conf.json
```

### 命名规范

#### 文件命名
- **组件**：PascalCase（如 `AccountCard.vue`）
- **工具函数**：kebab-case（如 `format-time.ts`）
- **Hooks**：camelCase + use前缀（如 `useBrowser.ts`）
- **Store**：kebab-case（如 `config-store.ts`）

#### 变量命名
- **变量/函数**：camelCase
- **常量**：UPPER_SNAKE_CASE
- **类型/接口**：PascalCase
- **私有变量**：_开头

### 代码规范

#### Vue组件
```vue
<script setup lang="ts">
// 1. 导入
import { ref, computed, onMounted } from 'vue'
import type { BrowserInfo } from '@/typings'

// 2. Props
interface Props {
  browserInfo: BrowserInfo
}
const props = defineProps<Props>()

// 3. Emits
const emit = defineEmits<{
  refresh: []
  delete: [id: string]
}>()

// 4. 响应式数据
const loading = ref(false)

// 5. 计算属性
const isOnline = computed(() => {
  // ...
})

// 6. 方法
function handleClick() {
  // ...
}

// 7. 生命周期
onMounted(() => {
  // ...
})
</script>

<template>
  <!-- 模板 -->
</template>

<style scoped lang="scss">
/* 样式 */
</style>
```

#### TypeScript
```typescript
// 类型定义
export interface BrowserInfo {
  id: string
  name: string
  // ...
}

// 函数类型
export type OpenBrowserFn = (browserId: string) => Promise<void>

// API返回类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message: string
}
```

---

## 技术栈版本

| 技术 | 版本 | 说明 |
|-----|------|------|
| Tauri | 1.5.x | 桌面应用框架 |
| Vue | 3.5.21 | 前端框架 |
| TypeScript | 5.9.2 | 类型系统 |
| Vite | 7.1.5 | 构建工具 |
| NaiveUI | 2.43.1 | UI组件库 |
| Pinia | 3.0.3 | 状态管理 |
| Vue Router | 4.5.1 | 路由 |
| UnoCSS | 66.5.1 | 原子化CSS |
| Python | 3.9+ | 后端脚本 |

---

## 开发计划

### 阶段一：基础设施（1-2天）
- [ ] 配置管理系统（Tauri Store）
- [ ] Python后端API封装
- [ ] 前端服务层封装
- [ ] Pinia状态管理

### 阶段二：核心功能（3-4天）
- [ ] 首页 - 状态监控
- [ ] 账号管理 - 列表和操作
- [ ] 微信扫码登录
- [ ] Cookie智能检测

### 阶段三：进阶功能（3-4天）
- [ ] Cookie智能保活
- [ ] 设置页
- [ ] IP管理
- [ ] 数据统计

### 阶段四：优化测试（1-2天）
- [ ] 性能优化
- [ ] 用户体验优化
- [ ] 测试和打包

**总计**：约12-15天

---

## 附录

### 参考资料
- [Tauri官方文档](https://tauri.app/)
- [Vue 3官方文档](https://vuejs.org/)
- [NaiveUI文档](https://www.naiveui.com/)
- [比特浏览器API文档](https://doc.bitbrowser.cn/)

### 联系方式
- 项目地址：`C:\Users\zhang\Desktop\视频号开发\toolbox`
- 旧版本参考：`C:\Users\zhang\Desktop\视频号开发\视频号工具箱`

---

**文档状态**：✅ 完成
**最后更新**：2025-10-09
