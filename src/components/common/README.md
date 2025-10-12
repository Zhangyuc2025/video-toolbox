# 通用组件库

基于 NaiveUI 封装的业务通用组件，提供统一的样式和交互体验。

## 组件列表

### 1. AppEmpty - 空状态组件

用于显示列表为空、搜索无结果等场景。

**Props:**
- `description` - 空状态描述（默认: '暂无数据'）
- `icon` - 图标名称
- `size` - 图标大小（默认: 120）
- `buttonText` - 按钮文本
- `showButton` - 是否显示按钮

**Events:**
- `action` - 点击按钮时触发

**示例:**
```vue
<AppEmpty
  description="暂无浏览器"
  button-text="创建浏览器"
  :show-button="true"
  @action="handleCreate"
/>
```

---

### 2. AppLoading - 加载组件

用于显示加载中状态。

**Props:**
- `description` - 加载提示文本（默认: '加载中...'）
- `size` - 尺寸: 'small' | 'medium' | 'large'（默认: 'medium'）
- `fullscreen` - 是否全屏显示（默认: false）
- `showMask` - 是否显示遮罩（默认: true）

**示例:**
```vue
<AppLoading description="正在加载浏览器列表..." />

<AppLoading fullscreen description="正在批量打开浏览器..." />
```

---

### 3. AppCard - 卡片容器

提供统一的卡片布局样式。

**Props:**
- `title` - 标题
- `bordered` - 是否显示边框（默认: true）
- `hoverable` - 是否可悬停（默认: false）
- `size` - 内边距大小: 'small' | 'medium' | 'large'（默认: 'medium'）
- `shadow` - 是否显示阴影（默认: false）

**Slots:**
- `default` - 卡片内容
- `header` - 头部内容
- `header-extra` - 头部额外内容
- `footer` - 底部内容
- `action` - 操作区域

**Events:**
- `click` - 点击卡片时触发

**示例:**
```vue
<AppCard title="浏览器列表" hoverable shadow>
  <template #header-extra>
    <n-button>新建</n-button>
  </template>

  <div>卡片内容</div>

  <template #footer>
    <div>底部内容</div>
  </template>
</AppCard>
```

---

### 4. AppStatus - 状态标签

用于显示不同状态的标记。

**Props:**
- `type` - 状态类型: 'success' | 'error' | 'warning' | 'info' | 'default'（默认: 'default'）
- `text` - 显示文本
- `dot` - 是否显示圆点（默认: false）
- `size` - 尺寸: 'small' | 'medium' | 'large'（默认: 'medium'）

**示例:**
```vue
<AppStatus type="success" text="运行中" dot />
<AppStatus type="error" text="已停止" />
<AppStatus type="warning" text="Cookie即将过期" />
```

---

### 5. AppProgress - 进度条

用于显示操作进度。

**Props:**
- `percentage` - 当前进度 (0-100)（必填）
- `status` - 状态: 'success' | 'error' | 'warning' | 'info' | 'default'（默认: 'default'）
- `showText` - 是否显示百分比文字（默认: true）
- `text` - 自定义文字
- `type` - 类型: 'line' | 'circle' | 'dashboard'（默认: 'line'）
- `height` - 进度条高度（默认: 8）
- `circleSize` - 圆形进度条尺寸（默认: 120）

**示例:**
```vue
<AppProgress :percentage="75" />

<AppProgress
  :percentage="50"
  text="已打开 5/10"
  status="info"
/>

<AppProgress
  type="circle"
  :percentage="80"
/>
```

---

### 6. AppBrowserCard - 浏览器卡片

用于展示浏览器信息。

**Props:**
- `browser` - 浏览器信息（必填）
- `showActions` - 是否显示操作按钮（默认: true）
- `selectable` - 是否可选中（默认: false）
- `selected` - 是否已选中（默认: false）

**Events:**
- `open` - 点击打开按钮
- `close` - 点击关闭按钮
- `delete` - 点击删除按钮
- `select` - 选中状态改变
- `click` - 点击卡片

**示例:**
```vue
<AppBrowserCard
  :browser="browserInfo"
  selectable
  :selected="isSelected"
  @open="handleOpen"
  @close="handleClose"
  @delete="handleDelete"
  @select="handleSelect"
/>
```

---

### 7. AppConfirm - 确认对话框

用于二次确认操作。

**Props:**
- `title` - 对话框标题（默认: '确认操作'）
- `content` - 内容（默认: '确定要执行此操作吗？'）
- `positiveText` - 确认按钮文字（默认: '确定'）
- `negativeText` - 取消按钮文字（默认: '取消'）
- `type` - 类型: 'default' | 'info' | 'success' | 'warning' | 'error'（默认: 'warning'）
- `showIcon` - 是否显示图标（默认: true）

**Events:**
- `confirm` - 确认时触发
- `cancel` - 取消时触发

**Methods:**
- `open()` - 打开对话框
- `close()` - 关闭对话框

**示例:**
```vue
<script setup>
import { ref } from 'vue'

const confirmRef = ref()

function handleDelete() {
  confirmRef.value?.open()
}

function handleConfirm() {
  // 执行删除操作
  console.log('确认删除')
}
</script>

<template>
  <n-button @click="handleDelete">删除</n-button>

  <AppConfirm
    ref="confirmRef"
    title="删除浏览器"
    content="确定要删除选中的浏览器吗？此操作不可恢复。"
    type="error"
    @confirm="handleConfirm"
  />
</template>
```

---

## 使用方式

### 全局注册（推荐用于常用组件）

```typescript
// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { AppEmpty, AppLoading, AppStatus } from '@/components/common'

const app = createApp(App)

app.component('AppEmpty', AppEmpty)
app.component('AppLoading', AppLoading)
app.component('AppStatus', AppStatus)

app.mount('#app')
```

### 按需引入

```vue
<script setup lang="ts">
import { AppBrowserCard, AppConfirm } from '@/components/common'
</script>

<template>
  <AppBrowserCard :browser="browserInfo" />
  <AppConfirm ref="confirmRef" />
</template>
```

---

## 设计原则

1. **基于 NaiveUI**: 所有组件都基于 NaiveUI 组件封装，保持一致的设计语言
2. **Props 优先**: 优先使用 Props 配置，保持 API 简洁
3. **Slots 扩展**: 提供合理的 Slots 用于自定义内容
4. **TypeScript**: 完整的 TypeScript 类型支持
5. **组合式 API**: 使用 Vue 3 Composition API
6. **响应式**: 支持响应式数据和动态更新

---

## 后续扩展

可根据业务需求继续添加以下组件：

- **AppTable** - 表格组件（带分页、排序、筛选）
- **AppForm** - 表单容器（带验证、布局）
- **AppDrawer** - 抽屉组件
- **AppModal** - 模态框组件
- **AppTooltip** - 工具提示组件
- **AppBadge** - 徽标组件
- **AppAvatar** - 头像组件
- **AppDivider** - 分割线组件

---

**创建日期**: 2025-10-09
**组件数量**: 7 个
**总代码行数**: 约 600 行
