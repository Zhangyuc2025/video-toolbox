# 项目配置指南

## 环境要求

### 必需工具

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 20.19.0 | JavaScript 运行时 |
| pnpm | >= 10.5.0 | 包管理器 |
| Rust | latest stable | Tauri 后端 |
| Python | >= 3.8 | Sidecar 脚本 |

### 推荐工具

- **VSCode** - 推荐的代码编辑器
- **Git** - 版本控制
- **Windows Terminal** / **iTerm2** - 更好的终端体验

---

## 快速开始

### 1. 安装依赖

```bash
# 安装前端依赖
pnpm install

# 安装 Python 依赖
cd python-backend
pip install -r requirements.txt
cd ..
```

### 2. 启动开发服务器

```bash
# 前端开发模式
pnpm dev

# Tauri 开发模式（包含前端）
pnpm tauri:dev
```

### 3. 构建应用

```bash
# 构建前端
pnpm build

# 构建 Tauri 应用
pnpm tauri:build
```

---

## VSCode 配置

### 安装推荐扩展

打开项目后，VSCode 会提示安装推荐的扩展，点击"安装全部"即可。

或手动安装：

1. 按 `Ctrl+Shift+X` 打开扩展面板
2. 搜索以下扩展并安装：
   - **Vue - Official** (vue.volar)
   - **ESLint** (dbaeumer.vscode-eslint)
   - **Prettier** (esbenp.prettier-vscode)
   - **Tauri** (tauri-apps.tauri-vscode)
   - **rust-analyzer** (rust-lang.rust-analyzer)

### 启用格式化

项目已配置自动格式化，保存时自动执行。

手动格式化：
- Windows/Linux: `Shift + Alt + F`
- macOS: `Shift + Option + F`

---

## 代码规范

### 运行检查

```bash
# ESLint 检查
pnpm lint:check

# Prettier 检查
pnpm format:check

# TypeScript 类型检查
pnpm typecheck

# 运行全部检查
pnpm check
```

### 自动修复

```bash
# ESLint 自动修复
pnpm lint

# Prettier 自动格式化
pnpm format
```

---

## Git Hooks

项目使用 `simple-git-hooks` 在提交前自动检查代码。

### 提交信息规范

提交信息格式：

```
<type>(<scope>): <subject>
```

**类型 (type)**:
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档变更
- `style`: 代码格式
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具变动

**示例**:
```bash
git commit -m "feat(browser): 添加批量打开功能"
git commit -m "fix(cookie): 修复同步失败问题"
git commit -m "docs: 更新开发规范"
```

---

## Python Sidecar 构建

### Windows

```powershell
cd python-backend
.\build_sidecar.ps1
```

### Linux / macOS

```bash
cd python-backend
chmod +x build_sidecar.sh
./build_sidecar.sh
```

构建完成后，可执行文件会自动复制到 `src-tauri/binaries/` 目录。

---

## 项目结构

```
toolbox/
├── src/                    # 前端源码
│   ├── components/         # Vue 组件
│   ├── composables/        # Composables
│   ├── pages/              # 页面
│   ├── services/           # Service 层
│   ├── stores/             # Pinia Stores
│   ├── typings/            # TypeScript 类型
│   └── utils/              # 工具函数
│
├── src-tauri/              # Tauri 后端
│   ├── src/                # Rust 源码
│   ├── binaries/           # Sidecar 可执行文件
│   └── target/             # Rust 构建输出
│
├── python-backend/         # Python 后端
│   ├── bitbrowser_api.py   # BitBrowser API
│   ├── bitbrowser_api.spec # PyInstaller 配置
│   └── build_sidecar.*     # 构建脚本
│
└── *.md                    # 文档
```

---

## 开发工作流

### 1. 创建功能分支

```bash
git checkout -b feature/your-feature-name
```

### 2. 开发功能

```bash
# 启动开发服务器
pnpm tauri:dev

# 进行代码修改...
```

### 3. 提交代码

```bash
# 检查代码
pnpm check

# 暂存更改
git add .

# 提交（会自动运行 lint）
git commit -m "feat: your feature description"
```

### 4. 推送代码

```bash
git push origin feature/your-feature-name
```

---

## 常见问题

### Q: pnpm install 报错？

**A**: 确保 Node.js 和 pnpm 版本满足要求：
```bash
node -v  # >= 20.19.0
pnpm -v  # >= 10.5.0
```

### Q: TypeScript 版本警告？

**A**: 这是正常的。项目使用 TypeScript 5.9.2，而某些依赖要求 < 5.9.0。
这不会影响功能，可以忽略。

### Q: Tauri 开发模式启动慢？

**A**: 首次启动需要编译 Rust 代码，后续启动会快很多。

### Q: Python Sidecar 构建失败？

**A**: 确保安装了所有 Python 依赖：
```bash
cd python-backend
pip install -r requirements.txt
pip install pyinstaller
```

### Q: ESLint 报错？

**A**: 运行自动修复：
```bash
pnpm lint
```

### Q: Prettier 格式不一致？

**A**: 运行格式化：
```bash
pnpm format
```

---

## 调试技巧

### 前端调试

1. 在浏览器中打开开发者工具（F12）
2. 使用 Vue Devtools 扩展
3. 在代码中使用 `console.log()` 或 `debugger`

### Tauri 调试

```bash
# 启用 Rust 日志
$env:RUST_LOG="debug"
pnpm tauri:dev
```

### Python 调试

```bash
# 直接运行 Python 脚本测试
cd python-backend
python bitbrowser_api.py --help
python bitbrowser_api.py list
```

---

## 性能优化

### 开发模式优化

```bash
# 使用更快的编译器
$env:CARGO_BUILD_JOBS=4
pnpm tauri:dev
```

### 构建优化

```bash
# 生产构建（体积更小）
pnpm tauri:build
```

---

## 更多资源

- [开发规范](./DEVELOPMENT_GUIDELINES.md)
- [基础设施文档](./INFRASTRUCTURE_COMPLETE.md)
- [Tauri 文档](https://tauri.app/)
- [Vue 3 文档](https://vuejs.org/)
- [NaiveUI 文档](https://www.naiveui.com/)
- [Pinia 文档](https://pinia.vuejs.org/)

---

**祝开发顺利！** 🎉
