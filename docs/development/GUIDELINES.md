# 视频号工具箱 - 开发规范

## 目录

- [1. 代码风格](#1-代码风格)
- [2. 命名规范](#2-命名规范)
- [3. 文件组织](#3-文件组织)
- [4. TypeScript 规范](#4-typescript-规范)
- [5. Vue 组件规范](#5-vue-组件规范)
- [6. Store 使用规范](#6-store-使用规范)
- [7. Service 调用规范](#7-service-调用规范)
- [8. 错误处理规范](#8-错误处理规范)
- [9. 注释规范](#9-注释规范)
- [10. Git 提交规范](#10-git-提交规范)
- [11. 测试规范](#11-测试规范)
- [12. 性能优化规范](#12-性能优化规范)

---

## 1. 代码风格

### 1.1 基础规则

**使用工具强制统一**:
- ESLint - 代码检查
- Prettier - 代码格式化
- EditorConfig - 编辑器配置

**基本规则**:
```typescript
// ✅ 推荐
const name = 'John'
const age = 30

function greet(name: string): string {
  return `Hello, ${name}!`
}

// ❌ 避免
var name = "John";  // 使用 var
const age=30;       // 缺少空格
function greet(name:string):string{  // 缺少空格
  return "Hello, "+name+"!";         // 使用字符串拼接
}
```

### 1.2 缩进和空格

- **缩进**: 2 个空格
- **引号**: 单引号
- **分号**: 不使用分号（依赖 ASI）
- **行尾**: LF（Unix 风格）
- **文件结尾**: 空行

```typescript
// ✅ 推荐
interface User {
  id: string
  name: string
  age: number
}

const user: User = {
  id: '1',
  name: 'John',
  age: 30
}

// ❌ 避免
interface User{
    id:string;
    name:string;
    age:number;
}
const user:User={id:"1",name:"John",age:30};
```

### 1.3 行宽限制

- 最大行宽: **100 字符**
- 长表达式需要换行

```typescript
// ✅ 推荐
const result = await batchOpenBrowsers(
  browserIds,
  {
    concurrency: 5,
    onProgress: (completed, total) => {
      console.log(`${completed}/${total}`)
    }
  }
)

// ❌ 避免
const result = await batchOpenBrowsers(browserIds, { concurrency: 5, onProgress: (completed, total) => { console.log(`${completed}/${total}`) } })
```

---

## 2. 命名规范

### 2.1 文件命名

**组件文件**: PascalCase（大驼峰）
```
AppEmpty.vue
AppBrowserCard.vue
BrowserList.vue
CookieManagement.vue
```

**其他文件**: kebab-case（短横线）
```typescript
// 工具函数
utils/batch-operations.ts
utils/concurrency.ts

// Composables
composables/use-debounce.ts
composables/use-storage.ts

// 类型定义
typings/browser.d.ts
typings/cookie.d.ts
```

**Store 文件**: kebab-case
```typescript
stores/browser.ts
stores/cookie.ts
stores/proxy.ts
```

**Service 文件**: kebab-case
```typescript
services/bitbrowser.ts
services/cookie.ts
```

### 2.2 变量命名

**变量和函数**: camelCase（小驼峰）
```typescript
// ✅ 推荐
const browserList = []
const isLoading = false
const selectedCount = 0

async function loadBrowsers() {}
async function handleBatchOpen() {}

// ❌ 避免
const BrowserList = []          // 应该用小驼峰
const is_loading = false        // 不要用下划线
const selected_count = 0

async function LoadBrowsers() {} // 不要用大驼峰
async function handle_batch_open() {}
```

**常量**: UPPER_SNAKE_CASE（大写下划线）
```typescript
// ✅ 推荐
const MAX_CONCURRENCY = 10
const API_BASE_URL = 'http://localhost:8000'
const CACHE_DURATION = 5 * 60 * 1000

// ❌ 避免
const maxConcurrency = 10       // 常量应该大写
const apiBaseUrl = 'http://localhost:8000'
```

**布尔值**: 使用 is/has/can 前缀
```typescript
// ✅ 推荐
const isLoading = ref(false)
const hasError = ref(false)
const canEdit = computed(() => user.role === 'admin')
const isRunning = browser.isRunning

// ❌ 避免
const loading = ref(false)      // 不清楚是动作还是状态
const error = ref(false)        // 容易混淆
const edit = computed(() => user.role === 'admin')
```

### 2.3 类型命名

**接口和类型**: PascalCase
```typescript
// ✅ 推荐
interface BrowserInfo {
  id: string
  name: string
}

type ProxyType = 'http' | 'https' | 'socks5'

class BrowserService extends BaseService {}

// ❌ 避免
interface browserInfo {}        // 应该用大驼峰
type proxy_type = string        // 应该用大驼峰
```

**枚举**: PascalCase，成员 UPPER_SNAKE_CASE
```typescript
// ✅ 推荐
enum BrowserStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  STOPPED = 'stopped'
}

// ❌ 避免
enum browserStatus {            // 应该用大驼峰
  idle = 'idle',               // 成员应该大写
  running = 'running'
}
```

### 2.4 组件命名

**组件名**: PascalCase，多词组合
```vue
<!-- ✅ 推荐 -->
<AppEmpty />
<AppBrowserCard />
<BrowserList />
<CookieManagement />

<!-- ❌ 避免 -->
<Empty />          <!-- 太通用 -->
<browser-card />   <!-- 应该用 PascalCase -->
<Browserlist />    <!-- 应该分词 -->
```

**组件实例**: camelCase
```typescript
// ✅ 推荐
const confirmRef = ref()
const browserCardRef = ref()

// ❌ 避免
const ConfirmRef = ref()        // 不要用大驼峰
const browser_card_ref = ref()  // 不要用下划线
```

### 2.5 Props 和 Events 命名

**Props**: camelCase
```typescript
// ✅ 推荐
interface Props {
  browserInfo: Browser.BrowserInfo
  showActions?: boolean
  isSelected?: boolean
}

// ❌ 避免
interface Props {
  BrowserInfo: Browser.BrowserInfo  // 不要用大驼峰
  show_actions?: boolean            // 不要用下划线
}
```

**Events**: kebab-case（在模板中），camelCase（在脚本中）
```vue
<script setup lang="ts">
// ✅ 推荐
const emit = defineEmits<{
  updateValue: [value: string]
  batchOpen: []
  deleteItem: [id: string]
}>()
</script>

<template>
  <!-- 在模板中使用 kebab-case -->
  <Component
    @update-value="handleUpdate"
    @batch-open="handleBatchOpen"
    @delete-item="handleDelete"
  />
</template>
```

---

## 3. 文件组织

### 3.1 目录结构

```
src/
├── assets/              # 静态资源
│   ├── images/
│   ├── styles/
│   └── fonts/
│
├── components/          # 组件
│   ├── common/         # 通用组件
│   ├── browser/        # 浏览器相关组件
│   ├── cookie/         # Cookie相关组件
│   └── proxy/          # 代理相关组件
│
├── composables/         # Composables
│   ├── use-debounce.ts
│   ├── use-storage.ts
│   └── index.ts
│
├── layouts/             # 布局组件
│   ├── DefaultLayout.vue
│   └── EmptyLayout.vue
│
├── pages/              # 页面
│   ├── browser/
│   │   ├── BrowserList.vue
│   │   └── BrowserDetail.vue
│   ├── cookie/
│   └── proxy/
│
├── router/             # 路由
│   ├── index.ts
│   └── routes.ts
│
├── services/           # Service 层
│   ├── base.ts
│   ├── bitbrowser.ts
│   └── index.ts
│
├── stores/             # Pinia Stores
│   ├── browser.ts
│   ├── cookie.ts
│   └── index.ts
│
├── typings/            # 类型定义
│   ├── browser.d.ts
│   └── cookie.d.ts
│
├── utils/              # 工具函数
│   ├── concurrency.ts
│   └── index.ts
│
├── App.vue             # 根组件
└── main.ts             # 入口文件
```

### 3.2 单文件组件结构

**推荐顺序**:
```vue
<!-- 1. 模板 -->
<template>
  <div class="component-name">
    <!-- 内容 -->
  </div>
</template>

<!-- 2. 脚本 -->
<script setup lang="ts">
// 导入
import { ref, computed, onMounted } from 'vue'
import type { Props } from './types'

// Props & Emits
interface Props {
  // ...
}

const props = defineProps<Props>()
const emit = defineEmits<{}>()

// 响应式数据
const loading = ref(false)

// 计算属性
const total = computed(() => items.value.length)

// 方法
async function loadData() {}

// 生命周期
onMounted(() => {})
</script>

<!-- 3. 样式 -->
<style scoped>
.component-name {
  /* ... */
}
</style>
```

### 3.3 导入顺序

```typescript
// 1. Vue 相关
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

// 2. 第三方库
import { NButton, NCard } from 'naive-ui'

// 3. 类型定义
import type { Browser } from '@/typings/browser'

// 4. Stores
import { useBrowserStore } from '@/stores'

// 5. Services
import { services } from '@/services'

// 6. Utils
import { batchOpenBrowsers } from '@/utils'

// 7. Composables
import { useDebounce } from '@/composables'

// 8. 组件
import AppEmpty from '@/components/common/AppEmpty.vue'

// 9. 相对路径导入
import { formatDate } from './utils'
import type { LocalProps } from './types'
```

---

## 4. TypeScript 规范

### 4.1 类型优先

**优先使用类型而非 any**:
```typescript
// ✅ 推荐
interface BrowserInfo {
  id: string
  name: string
  isRunning?: boolean
}

const browser: BrowserInfo = {
  id: '1',
  name: 'Test'
}

// ❌ 避免
const browser: any = {
  id: '1',
  name: 'Test'
}
```

### 4.2 使用类型推断

```typescript
// ✅ 推荐 - 让 TypeScript 推断
const name = 'John'                    // 推断为 string
const age = 30                         // 推断为 number
const items = ['a', 'b', 'c']         // 推断为 string[]

// ❌ 避免 - 不必要的类型注解
const name: string = 'John'
const age: number = 30
const items: string[] = ['a', 'b', 'c']

// ✅ 推荐 - 在必要时显式声明
const user: User = {
  id: '1',
  name: 'John'
}

async function getBrowserList(): Promise<Browser.BrowserInfo[]> {
  // ...
}
```

### 4.3 接口 vs 类型别名

**优先使用 interface** 用于对象类型:
```typescript
// ✅ 推荐 - 对象类型用 interface
interface User {
  id: string
  name: string
}

// ✅ 推荐 - 联合类型、元组等用 type
type Status = 'idle' | 'loading' | 'success' | 'error'
type Point = [number, number]
```

### 4.4 枚举使用

**优先使用字符串枚举**:
```typescript
// ✅ 推荐
enum BrowserStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  STOPPED = 'stopped'
}

// ❌ 避免 - 数字枚举不够清晰
enum BrowserStatus {
  IDLE,
  RUNNING,
  STOPPED
}

// ✅ 更好 - 使用联合类型
type BrowserStatus = 'idle' | 'running' | 'stopped'
```

### 4.5 泛型使用

```typescript
// ✅ 推荐 - 合理使用泛型
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

async function fetchData<T>(url: string): Promise<ApiResponse<T>> {
  // ...
}

// 使用
const response = await fetchData<BrowserInfo[]>('/browsers')

// ✅ 推荐 - 泛型约束
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}
```

### 4.6 严格空值检查

```typescript
// ✅ 推荐 - 处理可能的 null/undefined
interface User {
  id: string
  name?: string  // 可选属性
}

function greet(user: User) {
  // 使用可选链
  const name = user.name ?? 'Guest'
  console.log(`Hello, ${name}`)

  // 类型守卫
  if (user.name) {
    console.log(user.name.toUpperCase())
  }
}

// ❌ 避免 - 不检查空值
function greet(user: User) {
  console.log(user.name.toUpperCase())  // 可能报错
}
```

---

## 5. Vue 组件规范

### 5.1 组件定义

**使用 script setup**:
```vue
<!-- ✅ 推荐 -->
<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  title: string
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
})

const emit = defineEmits<{
  update: [value: number]
}>()
</script>

<!-- ❌ 避免 - 不使用 Options API -->
<script lang="ts">
export default {
  props: {
    title: String,
    count: Number
  },
  emits: ['update'],
  setup(props, { emit }) {
    // ...
  }
}
</script>
```

### 5.2 Props 定义

```typescript
// ✅ 推荐 - 使用 TypeScript 接口
interface Props {
  /** 浏览器信息 */
  browser: Browser.BrowserInfo
  /** 是否显示操作按钮 */
  showActions?: boolean
  /** 是否可选中 */
  selectable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
  selectable: false
})

// ❌ 避免 - 运行时 props
const props = defineProps({
  browser: {
    type: Object as PropType<Browser.BrowserInfo>,
    required: true
  },
  showActions: {
    type: Boolean,
    default: true
  }
})
```

### 5.3 Emits 定义

```typescript
// ✅ 推荐 - 类型化 emits
const emit = defineEmits<{
  // 无参数
  close: []
  // 单个参数
  update: [value: string]
  // 多个参数
  change: [id: string, value: number]
}>()

// 使用
emit('close')
emit('update', 'new value')
emit('change', '123', 42)

// ❌ 避免 - 无类型 emits
const emit = defineEmits(['close', 'update', 'change'])
```

### 5.4 Ref 和 Reactive

**优先使用 ref**:
```typescript
// ✅ 推荐
const count = ref(0)
const name = ref('')
const user = ref<User | null>(null)

// ✅ 可以 - reactive 用于复杂对象
const state = reactive({
  loading: false,
  data: [] as BrowserInfo[],
  error: null as Error | null
})

// ❌ 避免 - 不要混用
const count = ref(0)
const state = reactive({
  count: 0  // 重复
})
```

### 5.5 计算属性

```typescript
// ✅ 推荐 - 简单的计算属性
const total = computed(() => items.value.length)
const isValid = computed(() => name.value.length > 0)

// ✅ 推荐 - 可写计算属性
const fullName = computed({
  get: () => `${firstName.value} ${lastName.value}`,
  set: (value) => {
    const parts = value.split(' ')
    firstName.value = parts[0]
    lastName.value = parts[1] || ''
  }
})

// ❌ 避免 - 复杂逻辑应该提取为方法
const result = computed(() => {
  // 50 行代码...
})
```

### 5.6 生命周期

```typescript
// ✅ 推荐
onMounted(async () => {
  await loadData()
})

onBeforeUnmount(() => {
  clearInterval(timer)
})

// ❌ 避免 - 过度使用生命周期
onMounted(() => {})
onUpdated(() => {})
onBeforeUpdate(() => {})
// 应该考虑使用 watch 或 computed
```

### 5.7 Watch

```typescript
// ✅ 推荐 - 监听单个源
watch(searchKeyword, (newVal, oldVal) => {
  performSearch(newVal)
})

// ✅ 推荐 - 监听多个源
watch([firstName, lastName], ([newFirst, newLast]) => {
  fullName.value = `${newFirst} ${newLast}`
})

// ✅ 推荐 - watchEffect
watchEffect(() => {
  // 自动追踪依赖
  console.log(`Count: ${count.value}`)
})

// ✅ 推荐 - 立即执行
watch(source, callback, { immediate: true })

// ✅ 推荐 - 深度监听
watch(obj, callback, { deep: true })
```

### 5.8 模板语法

```vue
<template>
  <!-- ✅ 推荐 - 使用 v-if/v-else -->
  <AppLoading v-if="loading" />
  <AppEmpty v-else-if="total === 0" />
  <div v-else>
    <!-- 内容 -->
  </div>

  <!-- ✅ 推荐 - 列表渲染加 key -->
  <AppBrowserCard
    v-for="browser in browsers"
    :key="browser.id"
    :browser="browser"
  />

  <!-- ✅ 推荐 - 事件处理 -->
  <n-button @click="handleClick">点击</n-button>
  <n-button @click="() => handleDelete(id)">删除</n-button>

  <!-- ❌ 避免 - 在模板中写复杂表达式 -->
  <div>
    {{ items.filter(i => i.active).map(i => i.name).join(', ') }}
  </div>

  <!-- ✅ 推荐 - 使用计算属性 -->
  <div>{{ activeItemNames }}</div>
</template>

<script setup lang="ts">
const activeItemNames = computed(() =>
  items.value.filter(i => i.active).map(i => i.name).join(', ')
)
</script>
```

---

## 6. Store 使用规范

### 6.1 Store 定义

```typescript
// ✅ 推荐 - 使用 Composition API 风格
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useBrowserStore = defineStore('browser', () => {
  // State
  const browsers = ref<Browser.BrowserInfo[]>([])
  const loading = ref(false)
  const selectedIds = ref<Set<string>>(new Set())

  // Getters
  const total = computed(() => browsers.value.length)
  const selectedCount = computed(() => selectedIds.value.size)

  // Actions
  async function loadBrowsers(forceRefresh = false) {
    loading.value = true
    try {
      const data = await services.bitBrowser.getBrowserList()
      browsers.value = data
    } finally {
      loading.value = false
    }
  }

  function toggleSelect(id: string) {
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id)
    } else {
      selectedIds.value.add(id)
    }
  }

  return {
    // State
    browsers,
    loading,
    selectedIds,
    // Getters
    total,
    selectedCount,
    // Actions
    loadBrowsers,
    toggleSelect
  }
})
```

### 6.2 Store 使用

```typescript
// ✅ 推荐 - 在组件中使用
import { useBrowserStore } from '@/stores'

const browserStore = useBrowserStore()

// 访问 state
console.log(browserStore.browsers)

// 访问 getters
console.log(browserStore.total)

// 调用 actions
await browserStore.loadBrowsers()

// ❌ 避免 - 解构响应式数据
const { browsers, total } = useBrowserStore()  // 失去响应性

// ✅ 推荐 - 使用 storeToRefs
import { storeToRefs } from 'pinia'

const browserStore = useBrowserStore()
const { browsers, total } = storeToRefs(browserStore)
const { loadBrowsers } = browserStore
```

### 6.3 Store 组合

```typescript
// ✅ 推荐 - Store 之间可以相互调用
export const useBrowserStore = defineStore('browser', () => {
  const cookieStore = useCookieStore()
  const proxyStore = useProxyStore()

  async function openWithCookie(browserId: string) {
    // 使用其他 Store
    const cookie = await cookieStore.getCookieByBrowserId(browserId)
    // ...
  }

  return { openWithCookie }
})
```

---

## 7. Service 调用规范

### 7.1 Service 定义

```typescript
// ✅ 推荐
import { BaseService } from './base'

export class BitBrowserService extends BaseService {
  /**
   * 获取浏览器列表
   * @param page 页码
   * @param pageSize 每页数量
   */
  async getBrowserList(
    page: number = 0,
    pageSize: number = 100
  ): Promise<Browser.BrowserInfo[]> {
    this.log('info', 'Getting browser list', { page, pageSize })

    const response = await this.invoke<Browser.BrowserInfo[]>(
      'bb_get_browser_list',
      { page, page_size: pageSize }
    )

    if (!response.success || !response.data) {
      this.showMessage('error', '获取浏览器列表失败')
      return []
    }

    return response.data
  }
}
```

### 7.2 Service 使用

```typescript
// ✅ 推荐 - 通过 services 对象访问
import { services } from '@/services'

const browsers = await services.bitBrowser.getBrowserList()
const cookie = await services.cookie.getCookieByBrowserId(id)

// ❌ 避免 - 直接实例化
import { BitBrowserService } from '@/services/bitbrowser'
const service = new BitBrowserService()
```

### 7.3 错误处理

```typescript
// ✅ 推荐 - Service 层统一处理错误
export class BitBrowserService extends BaseService {
  async openBrowser(browserId: string) {
    try {
      const response = await this.invoke('bb_open_browser', { browser_id: browserId })

      if (!response.success) {
        this.showMessage('error', `打开浏览器失败: ${response.message}`)
        return null
      }

      this.showMessage('success', '浏览器已打开')
      return response.data
    } catch (error) {
      this.log('error', 'Failed to open browser', error)
      this.showMessage('error', '打开浏览器时发生错误')
      throw error
    }
  }
}

// ✅ 推荐 - 组件中简化错误处理
async function handleOpen() {
  loading.value = true
  try {
    await services.bitBrowser.openBrowser(browserId)
    // 成功后的操作
  } finally {
    loading.value = false
  }
}
```

---

## 8. 错误处理规范

### 8.1 Try-Catch

```typescript
// ✅ 推荐
async function loadData() {
  loading.value = true
  error.value = null

  try {
    const data = await services.bitBrowser.getBrowserList()
    browsers.value = data
  } catch (err) {
    error.value = err instanceof Error ? err : new Error(String(err))
    console.error('Failed to load browsers:', err)
  } finally {
    loading.value = false
  }
}

// ❌ 避免 - 吞掉错误
async function loadData() {
  try {
    const data = await services.bitBrowser.getBrowserList()
    browsers.value = data
  } catch (err) {
    // 什么都不做
  }
}
```

### 8.2 错误提示

```typescript
// ✅ 推荐 - 给用户明确的错误提示
async function handleDelete(id: string) {
  try {
    await services.bitBrowser.deleteBrowsers([id])
    window.$message?.success('删除成功')
    await loadBrowsers()
  } catch (error) {
    window.$message?.error(
      error instanceof Error ? error.message : '删除失败'
    )
  }
}

// ❌ 避免 - 不给用户反馈
async function handleDelete(id: string) {
  try {
    await services.bitBrowser.deleteBrowsers([id])
  } catch (error) {
    console.error(error)  // 用户不知道发生了什么
  }
}
```

### 8.3 类型安全的错误处理

```typescript
// ✅ 推荐
class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public data?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

async function someOperation() {
  throw new AppError('Operation failed', 'OP_001', { id: '123' })
}

// 使用
try {
  await someOperation()
} catch (error) {
  if (error instanceof AppError) {
    console.log(error.code, error.data)
  }
}
```

---

## 9. 注释规范

### 9.1 文件注释

```typescript
/**
 * 浏览器管理 Store
 *
 * 提供浏览器列表、选择、批量操作等功能
 *
 * @module stores/browser
 */
import { defineStore } from 'pinia'
```

### 9.2 函数注释

```typescript
/**
 * 批量打开浏览器
 *
 * @param browserIds - 浏览器 ID 列表
 * @param options - 批量操作选项
 * @param options.concurrency - 并发数（默认: 5）
 * @param options.onProgress - 进度回调
 * @returns 批量操作结果
 *
 * @example
 * ```typescript
 * const result = await batchOpenBrowsers(['id1', 'id2'], {
 *   concurrency: 5,
 *   onProgress: (completed, total) => {
 *     console.log(`${completed}/${total}`)
 *   }
 * })
 * ```
 */
export async function batchOpenBrowsers(
  browserIds: string[],
  options?: BatchOptions
): Promise<BatchResult> {
  // ...
}
```

### 9.3 接口注释

```typescript
/**
 * 浏览器信息
 */
export interface BrowserInfo {
  /** 浏览器唯一标识 */
  id: string

  /** 浏览器名称 */
  name: string

  /** 备注信息 */
  remark?: string

  /** 是否正在运行 */
  isRunning?: boolean

  /** 代理类型 */
  proxyType?: ProxyType
}
```

### 9.4 组件注释

```vue
<script setup lang="ts">
/**
 * 浏览器卡片组件
 *
 * 用于展示浏览器信息，支持选择和操作
 */

interface Props {
  /** 浏览器信息 */
  browser: Browser.BrowserInfo

  /** 是否显示操作按钮（默认: true） */
  showActions?: boolean

  /** 是否可选中（默认: false） */
  selectable?: boolean
}
</script>
```

### 9.5 TODO 注释

```typescript
// TODO: 实现浏览器自动重启功能
// FIXME: 修复批量关闭时的内存泄漏问题
// HACK: 临时解决方案，等待上游库修复
// NOTE: 这里的延迟是必要的，用于等待浏览器完全启动
```

---

## 10. Git 提交规范

### 10.1 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**:
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档变更
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例**:
```
feat(browser): 添加批量打开浏览器功能

- 实现并发控制
- 添加进度显示
- 支持错误重试

Closes #123
```

```
fix(cookie): 修复 Cookie 同步失败的问题

当 Cookie 数据为空时，同步会失败。
现在会先检查 Cookie 数据是否有效。

Fixes #456
```

```
docs: 更新开发规范文档

添加 Git 提交规范部分
```

### 10.2 分支命名

```
feature/browser-batch-open    # 新功能
bugfix/cookie-sync-error      # Bug 修复
hotfix/critical-memory-leak   # 紧急修复
refactor/service-layer        # 重构
docs/update-readme            # 文档更新
```

### 10.3 提交频率

- ✅ 每完成一个小功能就提交
- ✅ 每修复一个 bug 就提交
- ❌ 不要一次提交大量不相关的改动
- ❌ 不要提交未测试的代码

---

## 11. 测试规范

### 11.1 单元测试

```typescript
// browser.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBrowserStore } from '@/stores/browser'

describe('Browser Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should load browsers', async () => {
    const store = useBrowserStore()
    await store.loadBrowsers()

    expect(store.browsers).toBeDefined()
    expect(store.total).toBeGreaterThan(0)
  })

  it('should toggle selection', () => {
    const store = useBrowserStore()
    const id = 'test-id'

    store.toggleSelect(id)
    expect(store.isSelected(id)).toBe(true)

    store.toggleSelect(id)
    expect(store.isSelected(id)).toBe(false)
  })
})
```

### 11.2 组件测试

```typescript
// AppBrowserCard.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppBrowserCard from '@/components/common/AppBrowserCard.vue'

describe('AppBrowserCard', () => {
  it('renders browser info', () => {
    const wrapper = mount(AppBrowserCard, {
      props: {
        browser: {
          id: '1',
          name: 'Test Browser',
          isRunning: true
        }
      }
    })

    expect(wrapper.text()).toContain('Test Browser')
    expect(wrapper.find('.app-browser-card').exists()).toBe(true)
  })

  it('emits open event', async () => {
    const wrapper = mount(AppBrowserCard, {
      props: {
        browser: { id: '1', name: 'Test' }
      }
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('open')).toBeTruthy()
  })
})
```

---

## 12. 性能优化规范

### 12.1 组件懒加载

```typescript
// ✅ 推荐
const BrowserList = defineAsyncComponent(
  () => import('@/pages/browser/BrowserList.vue')
)

// 路由懒加载
const routes = [
  {
    path: '/browsers',
    component: () => import('@/pages/browser/BrowserList.vue')
  }
]
```

### 12.2 计算属性缓存

```typescript
// ✅ 推荐 - 使用计算属性
const filteredBrowsers = computed(() =>
  browsers.value.filter(b => b.name.includes(searchKeyword.value))
)

// ❌ 避免 - 在模板中直接过滤
<template>
  <div v-for="browser in browsers.filter(b => b.name.includes(searchKeyword))">
    <!-- ... -->
  </div>
</template>
```

### 12.3 v-show vs v-if

```vue
<!-- ✅ 推荐 - 频繁切换用 v-show -->
<div v-show="isVisible">
  <!-- 内容 -->
</div>

<!-- ✅ 推荐 - 条件渲染用 v-if -->
<AppLoading v-if="loading" />
<div v-else>
  <!-- 内容 -->
</div>
```

### 12.4 列表优化

```vue
<!-- ✅ 推荐 - 虚拟滚动 -->
<n-virtual-list
  :items="browsers"
  :item-size="120"
>
  <template #default="{ item }">
    <AppBrowserCard :browser="item" />
  </template>
</n-virtual-list>

<!-- ✅ 推荐 - 正确使用 key -->
<div v-for="browser in browsers" :key="browser.id">
  <!-- 内容 -->
</div>

<!-- ❌ 避免 - 使用 index 作为 key -->
<div v-for="(browser, index) in browsers" :key="index">
  <!-- 内容 -->
</div>
```

### 12.5 防抖和节流

```typescript
// ✅ 推荐
import { useDebounce } from '@/composables'

const handleSearch = useDebounce((keyword: string) => {
  performSearch(keyword)
}, 500)
```

---

## 配置文件

这些配置文件将在下一步创建：

- `.editorconfig` - 编辑器配置
- `.prettierrc` - 代码格式化
- `.eslintrc.cjs` - 代码检查
- `commitlint.config.js` - 提交信息检查

---

## 检查清单

在提交代码前，请检查：

- [ ] 代码符合命名规范
- [ ] 没有 TypeScript 错误
- [ ] 没有 ESLint 警告
- [ ] 代码已格式化（Prettier）
- [ ] 添加了必要的注释
- [ ] 提交信息符合规范
- [ ] 已测试代码功能
- [ ] 没有 console.log 等调试代码
- [ ] 导入语句已整理

---

**创建日期**: 2025-10-09
**适用范围**: 视频号工具箱项目
**维护**: 随项目演进持续更新
