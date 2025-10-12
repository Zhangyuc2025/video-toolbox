<!--
  状态标签组件
  用于显示不同状态的标记
-->
<script setup lang="ts">
import { computed } from 'vue'

type StatusType = 'success' | 'error' | 'warning' | 'info' | 'default'

interface Props {
  /** 状态类型 */
  type?: StatusType
  /** 显示文本 */
  text?: string
  /** 是否显示圆点 */
  dot?: boolean
  /** 尺寸 */
  size?: 'small' | 'medium' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  dot: false,
  size: 'medium'
})

const tagType = computed(() => {
  const typeMap: Record<StatusType, any> = {
    success: 'success',
    error: 'error',
    warning: 'warning',
    info: 'info',
    default: 'default'
  }
  return typeMap[props.type]
})
</script>

<template>
  <n-tag
    :type="tagType"
    :size="size"
    class="app-status"
  >
    <template v-if="dot" #icon>
      <div class="app-status__dot" />
    </template>
    <slot>{{ text }}</slot>
  </n-tag>
</template>

<style scoped>
.app-status {
  display: inline-flex;
  align-items: center;
}

.app-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}
</style>
