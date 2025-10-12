# 视频号工具箱

基于 Tauri + Vue 3 + TypeScript + NaiveUI 的桌面应用程序。

---

## 🚀 快速开始

### 环境要求

- Node.js >= 20.19.0
- pnpm >= 10.5.0
- Rust (latest stable)
- Python >= 3.8

### 安装依赖

```bash
# 安装前端依赖
pnpm install

# 安装 Python 依赖
cd python-backend
pip install -r requirements.txt
```

### 启动开发

```bash
# 前端开发模式
pnpm dev

# Tauri 开发模式（推荐）
pnpm tauri:dev
```

### 构建应用

```bash
# 构建前端
pnpm build

# 构建 Tauri 应用
pnpm tauri:build
```

---

## 📚 文档

### 核心文档

- [基础设施完成总结](./INFRASTRUCTURE_COMPLETE.md) - 项目架构和技术栈总览
- [开发规范](./docs/development/GUIDELINES.md) - 完整的开发规范
- [配置指南](./docs/development/SETUP.md) - 环境配置和常见问题
- [代码审查清单](./docs/development/CODE_REVIEW.md) - 代码审查检查清单

### 其他文档

- [功能需求](./docs/requirements.md) - 原始需求文档
- [任务归档](./docs/tasks/) - 各个任务的详细实现文档

---

## 🏗️ 技术栈

### 前端

- **框架**: Vue 3.5 + TypeScript 5.9
- **UI 库**: NaiveUI 2.43
- **状态管理**: Pinia 3.0
- **路由**: Vue Router 4.5
- **工具库**: VueUse, p-limit
- **构建工具**: Vite 7.1

### 后端

- **Tauri**: 1.5 (Rust)
- **Python Sidecar**: 3.8+
- **配置存储**: Tauri Plugin Store

---

## 📁 项目结构

```
toolbox/
├── src/                    # 前端源码
│   ├── components/         # Vue 组件
│   │   └── common/        # 通用组件（7个）
│   ├── composables/        # Composables（50+个）
│   ├── pages/              # 页面
│   ├── services/           # Service 层（4个服务）
│   ├── stores/             # Pinia Stores（4个）
│   ├── typings/            # TypeScript 类型
│   └── utils/              # 工具函数
│
├── src-tauri/              # Tauri 后端
│   ├── src/                # Rust 源码
│   ├── binaries/           # Sidecar 可执行文件
│   └── Cargo.toml
│
├── python-backend/         # Python 后端
│   ├── bitbrowser_api.py   # BitBrowser API
│   ├── bitbrowser_api.spec # PyInstaller 配置
│   └── build_sidecar.*     # 构建脚本
│
├── docs/                   # 文档
│   ├── development/        # 开发文档
│   ├── tasks/              # 任务归档
│   └── requirements.md     # 需求文档
│
└── INFRASTRUCTURE_COMPLETE.md  # 总览文档
```

---

## 🛠️ 开发工具

### 代码检查

```bash
# ESLint 检查
pnpm lint:check

# ESLint 自动修复
pnpm lint

# Prettier 检查
pnpm format:check

# Prettier 格式化
pnpm format

# TypeScript 类型检查
pnpm typecheck

# 运行全部检查
pnpm check
```

### VSCode 配置

项目已配置 VSCode 工作区设置：

- 保存时自动格式化（Prettier）
- 保存时自动修复（ESLint）
- 推荐扩展自动提示

首次打开项目时，请安装推荐的扩展。

---

## 🎯 核心功能

### 已实现的基础设施（11/11）

✅ **任务 1**: TypeScript 类型定义（5 个文件，400+ 行）
✅ **任务 2**: 配置管理系统（Plugin Store + Rust State）
✅ **任务 3**: BitBrowser API（Python CLI + 20+ 方法）
⏭️ **任务 4**: 视频号 API（已暂缓）
✅ **任务 5**: Python 脚本打包（PyInstaller Sidecar）
✅ **任务 6**: Tauri Command（11 个命令）
✅ **任务 7**: Service 层（4 个服务，60+ 方法）
✅ **任务 8**: Pinia Store（4 个 Store，99 个 actions）
✅ **任务 9**: VueUse 集成（50+ composables）
✅ **任务 10**: 并发控制（p-limit + 批量操作）
✅ **任务 11**: 通用组件（7 个组件）

### 技术能力

- ✅ 完整的 TypeScript 类型系统
- ✅ 统一的 Service 层封装
- ✅ 强大的状态管理（Pinia）
- ✅ 并发控制和批量操作
- ✅ 丰富的 Composables（50+）
- ✅ 通用 UI 组件（7 个）
- ✅ Python Sidecar 集成

---

## 📝 开发规范

项目遵循严格的开发规范，详见 [开发规范文档](./docs/development/GUIDELINES.md)。

### 代码风格

- 缩进: 2 空格
- 引号: 单引号
- 分号: 不使用
- 行宽: 100 字符

### 命名规范

- 文件: `PascalCase.vue` / `kebab-case.ts`
- 变量: `camelCase`
- 常量: `UPPER_SNAKE_CASE`
- 类型: `PascalCase`

### Git 提交规范

```
<type>(<scope>): <subject>

示例:
feat(browser): 添加批量打开功能
fix(cookie): 修复同步失败问题
docs: 更新文档
```

---

## 🧪 测试

```bash
# 运行测试（待配置）
pnpm test

# 测试覆盖率
pnpm test:coverage
```

---

## 📦 构建

### 开发构建

```bash
pnpm tauri:dev
```

### 生产构建

```bash
# 构建 Python Sidecar（首次或更新时）
cd python-backend
./build_sidecar.ps1  # Windows
./build_sidecar.sh   # Linux/macOS

# 构建 Tauri 应用
cd ..
pnpm tauri:build
```

构建产物位于 `src-tauri/target/release/`。

---

## 🐛 调试

### 前端调试

1. 启动开发服务器：`pnpm dev`
2. 打开浏览器开发者工具（F12）
3. 使用 Vue Devtools 扩展

### Tauri 调试

```bash
# 启用 Rust 日志
$env:RUST_LOG="debug"
pnpm tauri:dev
```

### Python 调试

```bash
cd python-backend
python bitbrowser_api.py --help
python bitbrowser_api.py list
```

---

## 🤝 贡献

### 开发流程

1. 创建功能分支：`git checkout -b feature/your-feature`
2. 开发功能
3. 运行检查：`pnpm check`
4. 提交代码：`git commit -m "feat: your feature"`
5. 推送分支：`git push origin feature/your-feature`

### 代码审查

提交前请使用 [代码审查清单](./docs/development/CODE_REVIEW.md) 自检。

---

## 📄 许可证

MIT License

---

## 🔗 相关链接

- [Tauri 文档](https://tauri.app/)
- [Vue 3 文档](https://vuejs.org/)
- [NaiveUI 文档](https://www.naiveui.com/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [VueUse 文档](https://vueuse.org/)

---

**开发状态**: 基础设施完成 ✅
**下一步**: 业务功能开发

---

*生成时间: 2025-10-09*
