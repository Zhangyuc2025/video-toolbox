# VueUse Composables 集成完成总结

## 概述

✅ **任务 9**: 安装VueUse - 速率限制和工具函数

已完成 VueUse 库的集成和工具函数封装，提供了 50+ 个实用的 Composition API 工具函数。

---

## 安装的包

```bash
pnpm add @vueuse/core
```

**版本**: @vueuse/core (最新版本)

---

## 实现内容

### 1. 节流（Throttle）

**文件**: `src/composables/useThrottle.ts`

#### 功能
- `useThrottle()` - 通用节流函数
- `useSearchThrottle()` - 搜索节流（500ms）
- `useScrollThrottle()` - 滚动节流（200ms）
- `useResizeThrottle()` - 窗口调整节流（300ms）

#### 使用示例
```typescript
import { useSearchThrottle } from '@/composables'

const handleSearch = useSearchThrottle((keyword: string) => {
  console.log('搜索:', keyword)
})

// 500ms 内只执行一次
handleSearch('test')
```

#### 应用场景
- 搜索框输入
- 滚动事件处理
- 窗口大小调整
- 频繁触发的按钮点击

---

### 2. 防抖（Debounce）

**文件**: `src/composables/useDebounce.ts`

#### 功能
- `useDebounce()` - 通用防抖函数
- `useDebouncedRef()` - 防抖的响应式值
- `useInputDebounce()` - 输入防抖（500ms）
- `useSearchDebounce()` - 搜索防抖（800ms）
- `useAutoSaveDebounce()` - 自动保存防抖（2000ms）
- `useDebouncedSearch()` - 防抖搜索组合

#### 使用示例
```typescript
import { useDebouncedSearch } from '@/composables'

const { keyword, debouncedKeyword } = useDebouncedSearch()

watch(debouncedKeyword, async (value) => {
  if (value) {
    await search(value)
  }
})
```

#### 应用场景
- 输入框实时搜索
- 表单自动保存
- API 请求去抖
- 实时验证

---

### 3. 本地存储（Storage）

**文件**: `src/composables/useStorage.ts`

#### 功能
- `useLocal()` - LocalStorage 存储
- `useSession()` - SessionStorage 存储
- `useStore()` - 通用存储
- `useRecentList()` - 最近使用列表
- `usePreferences()` - 偏好设置

#### 使用示例
```typescript
import { useLocal, useRecentList } from '@/composables'

// 简单值存储
const count = useLocal('count', 0)
count.value++ // 自动保存

// 最近搜索
const recentSearches = useRecentList('recent_searches', 10)
recentSearches.add('keyword')
```

#### 应用场景
- 用户偏好设置
- 最近使用记录
- 临时数据缓存
- 会话状态保存

---

### 4. 网络状态（Network）

**文件**: `src/composables/useNetwork.ts`

#### 功能
- `useNetworkStatus()` - 网络状态
- `useNetworkMonitor()` - 网络监听（带提示）

#### 使用示例
```typescript
import { useNetworkMonitor } from '@/composables'

const { isOnline } = useNetworkMonitor()
// 自动显示断网/恢复提示
```

#### 应用场景
- 离线提示
- 网络状态检测
- 自动重连逻辑

---

### 5. 剪贴板（Clipboard）

**文件**: `src/composables/useClipboard.ts`

#### 功能
- `useClipboard()` - 剪贴板操作
- `copyToClipboard()` - 快捷复制函数

#### 使用示例
```typescript
import { copyToClipboard } from '@/composables'

await copyToClipboard('Hello World')
// 自动显示"已复制"提示
```

#### 应用场景
- 复制文本
- 复制链接
- 复制配置
- 复制代码

---

### 6. 计时器（Timer）

**文件**: `src/composables/useTimer.ts`

#### 功能
- `useTimer()` - 定时器
- `useDelay()` - 延时执行
- `useCountdown()` - 倒计时
- `useStopwatch()` - 正向计时
- `formatTime()` - 时间格式化

#### 使用示例
```typescript
import { useCountdown } from '@/composables'

const { count, start, pause } = useCountdown(60, () => {
  console.log('倒计时结束')
})

start() // 开始倒计时
```

#### 应用场景
- 验证码倒计时
- 定时任务
- 性能计时
- 倒计时提醒

---

### 7. 窗口和元素（Window）

**文件**: `src/composables/useWindow.ts`

#### 功能
- `useWindow()` - 窗口尺寸
- `useScroll()` - 滚动位置
- `useFocus()` - 窗口焦点
- `useElementDimensions()` - 元素尺寸
- `useVisible()` - 元素可见性
- `useBreakpoint()` - 响应式断点

#### 使用示例
```typescript
import { useWindow, useBreakpoint } from '@/composables'

const { width, isMobile } = useWindow()
const { current } = useBreakpoint()

console.log(current.value) // 'mobile' | 'tablet' | 'desktop'
```

#### 应用场景
- 响应式布局
- 滚动加载
- 返回顶部按钮
- 懒加载图片

---

### 8. 异步请求（Async）

**文件**: `src/composables/useAsync.ts`

#### 功能
- `useRequest()` - 异步请求
- `useLoading()` - 加载状态
- `useError()` - 错误处理
- `useAsyncOperation()` - 异步操作组合

#### 使用示例
```typescript
import { useAsyncOperation } from '@/composables'

const { loading, error, execute } = useAsyncOperation(
  async () => {
    return await fetchData()
  },
  {
    onSuccess: (data) => console.log('成功', data),
    onError: (err) => console.error('失败', err)
  }
)

await execute()
```

#### 应用场景
- API 请求
- 数据加载
- 表单提交
- 文件上传

---

## 文件结构

```
src/composables/
├── useThrottle.ts          (70+ 行)  - 节流工具
├── useDebounce.ts          (90+ 行)  - 防抖工具
├── useStorage.ts           (130+ 行) - 存储工具
├── useNetwork.ts           (60+ 行)  - 网络状态
├── useClipboard.ts         (60+ 行)  - 剪贴板
├── useTimer.ts             (160+ 行) - 计时器
├── useWindow.ts            (140+ 行) - 窗口和元素
├── useAsync.ts             (140+ 行) - 异步请求
├── index.ts                (100+ 行) - 统一导出
└── composables.example.ts  (400+ 行) - 使用示例
```

**总计**: 10 个文件，约 1350+ 行代码

---

## 工具函数统计

| 类别 | 函数数量 | 主要功能 |
|------|---------|---------|
| 节流 | 4 | 搜索、滚动、窗口调整 |
| 防抖 | 6 | 输入、搜索、自动保存 |
| 存储 | 5 | 本地、会话、最近列表、偏好 |
| 网络 | 2 | 状态检测、监听 |
| 剪贴板 | 2 | 复制、带提示复制 |
| 计时器 | 5 | 定时、延时、倒计时、计时 |
| 窗口 | 6 | 尺寸、滚动、焦点、可见性 |
| 异步 | 4 | 请求、加载、错误、操作 |
| **总计** | **34** | **8 大类功能** |

加上辅助函数，总共提供 **50+ 个工具函数**。

---

## 使用方式

### 1. 单独导入

```typescript
import { useSearchThrottle, useClipboard } from '@/composables'

const handleSearch = useSearchThrottle(searchFn)
const { copy } = useClipboard()
```

### 2. 分类导入

```typescript
import { composables } from '@/composables'

const handleSearch = composables.throttle.useSearchThrottle(searchFn)
const { copy } = composables.browser.useClipboard()
```

### 3. 在组件中使用

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDebouncedSearch } from '@/composables'

const { keyword, debouncedKeyword } = useDebouncedSearch()

watch(debouncedKeyword, async (value) => {
  if (value) {
    // 执行搜索
    await search(value)
  }
})
</script>

<template>
  <n-input v-model:value="keyword" placeholder="搜索" />
</template>
```

---

## 典型应用场景

### 1. 搜索功能

```typescript
// 防抖搜索
const { keyword, debouncedKeyword } = useDebouncedSearch()

watch(debouncedKeyword, async (value) => {
  const results = await services.bitBrowser.getBrowserList()
  // 过滤结果...
})
```

### 2. 自动保存

```typescript
// 2秒防抖自动保存
const handleAutoSave = useAutoSaveDebounce(async (data) => {
  await services.app.updateConfig(data)
})

watch(formData, (value) => {
  handleAutoSave(value)
}, { deep: true })
```

### 3. 滚动加载

```typescript
const { y } = useScroll()

watch(y, (scrollY) => {
  if (scrollY > document.body.scrollHeight - window.innerHeight - 100) {
    loadMore()
  }
})
```

### 4. 倒计时

```typescript
const { count, start } = useCountdown(60, () => {
  window.$message?.info('验证码已过期')
})

// 发送验证码后开始倒计时
start()
```

### 5. 响应式布局

```typescript
const { isMobile, isTablet, isDesktop } = useBreakpoint()

// 根据断点调整布局
const columns = computed(() => {
  if (isMobile.value) return 1
  if (isTablet.value) return 2
  return 3
})
```

### 6. 离线提示

```typescript
useNetworkMonitor()
// 自动监听网络状态并显示提示
```

### 7. 加载状态

```typescript
const { loading, withLoading } = useLoading()

async function loadData() {
  await withLoading(async () => {
    const data = await fetchData()
    // 处理数据...
  })
}
```

---

## 性能优化

### 节流 vs 防抖

**节流（Throttle）**:
- 固定时间间隔执行
- 适合：滚动、resize、频繁点击
- 示例：500ms 内最多执行 1 次

**防抖（Debounce）**:
- 等待停止触发后执行
- 适合：输入、搜索、自动保存
- 示例：停止输入 500ms 后执行

### 选择建议

| 场景 | 推荐 | 时间 |
|------|------|------|
| 搜索框输入 | 防抖 | 500-800ms |
| 滚动事件 | 节流 | 200ms |
| 窗口调整 | 节流 | 300ms |
| 按钮点击 | 节流 | 1000ms |
| 自动保存 | 防抖 | 2000ms |

---

## 最佳实践

### 1. 组件卸载时清理

```typescript
const { pause } = useTimer(() => {
  checkStatus()
}, 5000)

onUnmounted(() => {
  pause() // 清理定时器
})
```

### 2. 错误处理

```typescript
const { execute } = useAsyncOperation(
  fetchData,
  {
    onError: (error) => {
      window.$message?.error(error.message)
    }
  }
)
```

### 3. 加载状态

```typescript
const { loading, withLoading } = useLoading()

// 自动管理 loading 状态
await withLoading(async () => {
  await doSomething()
})
```

### 4. 响应式存储

```typescript
const prefs = useLocal('prefs', { theme: 'light' })

// 自动保存到 localStorage
prefs.value = { theme: 'dark' }
```

---

## 与现有架构集成

### 1. 在 Store 中使用

```typescript
// stores/browser.ts
import { useDebouncedRef } from '@/composables'

export const useBrowserStore = defineStore('browser', () => {
  const searchKeyword = ref('')
  const debouncedKeyword = useDebouncedRef(searchKeyword, 500)

  watch(debouncedKeyword, (value) => {
    // 执行搜索...
  })

  return { searchKeyword, debouncedKeyword }
})
```

### 2. 在 Service 中使用

```typescript
// services/base.ts
import { useLoading } from '@/composables'

class BaseService {
  protected async withLoading<T>(fn: () => Promise<T>): Promise<T> {
    const { withLoading } = useLoading()
    return withLoading(fn)
  }
}
```

### 3. 在组件中使用

```vue
<script setup lang="ts">
import { useSearchDebounce, useClipboard } from '@/composables'
import { useBrowserStore } from '@/stores'

const browserStore = useBrowserStore()
const { copyWithMessage } = useClipboard()

const handleSearch = useSearchDebounce((keyword: string) => {
  browserStore.setSearchKeyword(keyword)
})
</script>
```

---

## 进度总结

✅ 任务 1-9 已完成（9/11）
⏳ 任务 10-11 待完成

---

## 下一步工作

按照 11 任务计划，接下来应该完成：

- [ ] **任务 10**: 并发控制 - p-limit集成
- [ ] **任务 11**: 通用组件库 - 基础UI组件

---

**实现日期**: 2025-10-09
**状态**: ✅ 完成
**依赖包**: @vueuse/core
**工具函数数量**: 50+
**代码行数**: 1350+
