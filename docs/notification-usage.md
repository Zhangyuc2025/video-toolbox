# 通知系统使用文档

## 概述

项目使用统一的通知工具 `@/utils/notification`，所有通知都会在**右下角**显示。

## 配置位置

在 `src/utils/notification.ts` 的 `NOTIFICATION_CONFIG` 中修改全局样式：

```typescript
const NOTIFICATION_CONFIG = {
  notification: {
    duration: 4500,              // 显示时长
    placement: 'bottom-right',   // 👈 修改显示位置
    keepAliveOnHover: true,      // 鼠标悬停时保持显示
    closable: true,              // 显示关闭按钮
    maxCount: 3                  // 最大同时显示数量
  }
}
```

## 支持的显示位置

- `top-left` - 左上角
- `top-right` - 右上角
- `bottom-left` - 左下角
- `bottom-right` - 右下角（默认）

## 使用示例

### 1. 基本使用

```typescript
import { notification } from '@/utils';

// 成功通知
notification.success('操作成功');

// 错误通知
notification.error('操作失败，请重试');

// 警告通知
notification.warning('Cookie 即将过期');

// 信息通知
notification.info('系统维护通知');
```

### 2. 自定义标题

```typescript
notification.success('浏览器已成功打开', {
  title: '操作成功'
});

notification.error('网络连接失败', {
  title: '连接错误',
  duration: 6000  // 覆盖默认时长
});
```

### 3. 临时改变位置

```typescript
notification.info('重要提示', {
  title: '通知',
  placement: 'top-right'  // 仅此次显示在右上角
});
```

### 4. 加载提示（使用 message）

如果需要顶部中间的轻量提示，使用 `message`：

```typescript
import { message } from '@/utils';

// 加载提示
const loading = message.loading('正在加载...');
// 完成后销毁
message.destroyAll();

// 快速提示
message.success('保存成功');
```

## 组件中使用

```vue
<script setup lang="ts">
import { notification, message } from '@/utils';

async function handleSave() {
  try {
    await saveData();
    notification.success('数据已保存', { title: '保存成功' });
  } catch (error) {
    notification.error('保存失败，请重试', { title: '错误' });
  }
}
</script>
```

## message vs notification 对比

| 特性 | message | notification |
|------|---------|--------------|
| 位置 | 顶部中间 | 右下角（可配置） |
| 标题 | 无 | 有 |
| 样式 | 轻量级 | 完整卡片 |
| 适用场景 | 快速反馈 | 重要提示 |

## 推荐使用规则

- ✅ 使用 `notification` 作为主要通知方式（右下角）
- ✅ 使用 `message.loading()` 作为加载提示
- ✅ 使用 `dialog` 作为确认对话框

## 全局样式修改

需要修改所有通知的样式？只需编辑一个地方：

**文件**: `src/utils/notification.ts`

```typescript
const NOTIFICATION_CONFIG = {
  notification: {
    duration: 5000,              // 改成 5 秒
    placement: 'top-right',      // 改成右上角
    keepAliveOnHover: true,
    closable: true,
    maxCount: 5                  // 最多显示 5 个
  }
}
```

保存后，所有使用 `notification` 的地方都会生效！
