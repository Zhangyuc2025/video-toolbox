# 代码审查检查清单

在提交代码或进行 Code Review 时，请使用此清单确保代码质量。

---

## 1. 代码风格

### 命名规范
- [ ] 文件名符合规范（组件: PascalCase，其他: kebab-case）
- [ ] 变量和函数使用 camelCase
- [ ] 常量使用 UPPER_SNAKE_CASE
- [ ] 类型和接口使用 PascalCase
- [ ] 布尔值使用 is/has/can 前缀

### 格式化
- [ ] 代码已使用 Prettier 格式化
- [ ] 通过 ESLint 检查
- [ ] 没有多余的空行或空格
- [ ] 行宽不超过 100 字符

### 导入顺序
- [ ] 导入语句按规范排序（Vue → 第三方 → 类型 → Store → Service → Utils → 组件）
- [ ] 没有未使用的导入

---

## 2. TypeScript

### 类型安全
- [ ] 没有使用 `any` 类型（必要时使用 `unknown`）
- [ ] Props 和 Events 有完整的类型定义
- [ ] 函数有明确的返回类型
- [ ] 异步函数返回 `Promise<T>`

### 类型定义
- [ ] 使用 interface 定义对象类型
- [ ] 使用 type 定义联合类型、元组等
- [ ] 复杂类型提取到单独的类型文件

### 空值处理
- [ ] 正确处理 `null` 和 `undefined`
- [ ] 使用可选链 `?.` 和 空值合并 `??`
- [ ] 在必要时使用类型守卫

---

## 3. Vue 组件

### 组件结构
- [ ] 使用 `<script setup lang="ts">`
- [ ] Props 使用 TypeScript 接口定义
- [ ] Emits 有完整的类型定义
- [ ] 组件顺序：template → script → style

### 响应式数据
- [ ] 优先使用 `ref` 而非 `reactive`
- [ ] 没有解构响应式对象（或使用 `toRefs`）
- [ ] 计算属性逻辑简洁
- [ ] Watch 使用合理（考虑使用 computed 替代）

### 模板语法
- [ ] 列表渲染使用 `:key`（值为唯一标识）
- [ ] 避免在模板中写复杂表达式
- [ ] 使用 `v-if`/`v-else` 而非三元运算符
- [ ] 事件处理器命名清晰（handle* 前缀）

### Props 验证
- [ ] 必填 Props 没有默认值
- [ ] 可选 Props 有合理的默认值
- [ ] Props 文档注释完整

---

## 4. Store 使用

### Store 定义
- [ ] 使用 Composition API 风格
- [ ] State、Getters、Actions 分类清晰
- [ ] 异步操作在 Actions 中
- [ ] Loading 和 Error 状态管理

### Store 使用
- [ ] 通过 `useXxxStore()` 访问
- [ ] 解构时使用 `storeToRefs`
- [ ] Actions 直接调用（不需要 storeToRefs）

---

## 5. Service 调用

### API 调用
- [ ] 通过 `services.xxx` 统一调用
- [ ] 不直接调用 `invoke`
- [ ] 错误处理在 Service 层
- [ ] 用户提示在 Service 层

### 错误处理
- [ ] 使用 try-catch 处理异步错误
- [ ] 错误有用户友好的提示
- [ ] 错误日志记录完整
- [ ] Loading 状态在 finally 中重置

---

## 6. 性能优化

### 组件优化
- [ ] 大组件使用懒加载
- [ ] 长列表使用虚拟滚动
- [ ] 频繁切换使用 `v-show` 而非 `v-if`
- [ ] 计算属性缓存复杂计算

### 防抖节流
- [ ] 搜索输入使用防抖
- [ ] 滚动事件使用节流
- [ ] 窗口 resize 使用节流

### 批量操作
- [ ] 使用并发控制工具
- [ ] 显示进度提示
- [ ] 错误处理和重试

---

## 7. 代码质量

### 可读性
- [ ] 函数和变量命名清晰
- [ ] 复杂逻辑有注释说明
- [ ] 魔法数字提取为常量
- [ ] 单个函数不超过 50 行

### 可维护性
- [ ] 没有重复代码（DRY 原则）
- [ ] 函数职责单一（SRP 原则）
- [ ] 依赖注入而非硬编码
- [ ] 易于测试

### 可扩展性
- [ ] 使用接口而非实现
- [ ] 开闭原则（对扩展开放，对修改关闭）
- [ ] 组件和函数易于复用

---

## 8. 安全性

### 输入验证
- [ ] 用户输入有验证
- [ ] XSS 防护（避免 v-html）
- [ ] SQL 注入防护（参数化查询）

### 数据保护
- [ ] 敏感数据加密存储
- [ ] API 密钥不暴露在前端
- [ ] 用户权限检查

---

## 9. 测试

### 单元测试
- [ ] 核心功能有单元测试
- [ ] 测试覆盖率 > 80%
- [ ] 边界情况有测试
- [ ] 错误情况有测试

### 组件测试
- [ ] 组件渲染正确
- [ ] Props 传递正确
- [ ] Events 触发正确
- [ ] 用户交互正常

---

## 10. 文档

### 代码注释
- [ ] 复杂逻辑有注释
- [ ] 公共 API 有 JSDoc
- [ ] TODO/FIXME 有说明
- [ ] 注释准确且及时更新

### 文档更新
- [ ] README 更新
- [ ] API 文档更新
- [ ] 变更日志更新

---

## 11. Git

### 提交规范
- [ ] 提交信息符合规范（type(scope): subject）
- [ ] 每次提交只做一件事
- [ ] 提交前运行过测试
- [ ] 没有提交调试代码

### 分支管理
- [ ] 分支命名规范
- [ ] 从正确的分支创建
- [ ] 合并前解决冲突

---

## 12. 其他

### 依赖管理
- [ ] 新增依赖有必要性
- [ ] 依赖版本合理
- [ ] package.json 更新

### 兼容性
- [ ] 浏览器兼容性
- [ ] 不同平台测试（Windows/Linux/macOS）
- [ ] 不同分辨率测试

### 无障碍
- [ ] 语义化 HTML
- [ ] 键盘可访问
- [ ] ARIA 属性

---

## 使用方法

### 代码提交前

```bash
# 1. 自检
# 按照此清单自检代码

# 2. 运行检查
pnpm check

# 3. 运行测试
pnpm test

# 4. 提交代码
git add .
git commit -m "feat: your feature"
```

### Code Review 时

1. **功能检查**: 功能是否正确实现？
2. **代码质量**: 代码是否符合规范？
3. **性能考虑**: 是否有性能问题？
4. **安全考虑**: 是否有安全隐患？
5. **测试覆盖**: 测试是否充分？
6. **文档完整**: 文档是否更新？

### 评审意见分级

- **🔴 Blocker**: 必须修复才能合并
- **🟡 Major**: 建议修复（影响较大）
- **🟢 Minor**: 可选修复（影响较小）
- **💡 Suggestion**: 建议改进（非必须）

---

## 示例

### ✅ 好的代码

```typescript
/**
 * 批量打开浏览器
 */
async function handleBatchOpen() {
  if (browserStore.selectedCount === 0) {
    window.$message?.warning('请先选择浏览器')
    return
  }

  loading.value = true

  try {
    const result = await batchOpenBrowsers(
      browserStore.selectedIds,
      {
        concurrency: 5,
        onProgress: (completed, total) => {
          progress.value = Math.round((completed / total) * 100)
        }
      }
    )

    if (result.successCount === result.total) {
      window.$message?.success('所有浏览器已打开')
    } else {
      window.$message?.warning(
        `打开完成: 成功 ${result.successCount}, 失败 ${result.failedCount}`
      )
    }

    await browserStore.loadBrowsers()
  } catch (error) {
    window.$message?.error('批量打开失败')
    console.error('Failed to batch open browsers:', error)
  } finally {
    loading.value = false
  }
}
```

### ❌ 不好的代码

```typescript
// 没有类型，没有错误处理，没有用户提示
async function open() {
  const r = await batchOpenBrowsers(browserStore.selectedIds)
  browserStore.loadBrowsers()
}
```

---

**持续改进代码质量，打造高质量应用！** 💪
