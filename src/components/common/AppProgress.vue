<!--
  进度条组件
  用于显示操作进度
-->
<script setup lang="ts">
import { computed } from 'vue'

type ProgressStatus = 'success' | 'error' | 'warning' | 'info' | 'default'

interface Props {
  /** 当前进度 (0-100) */
  percentage: number
  /** 状态 */
  status?: ProgressStatus
  /** 是否显示百分比文字 */
  showText?: boolean
  /** 自定义文字 */
  text?: string
  /** 类型 */
  type?: 'line' | 'circle' | 'dashboard'
  /** 进度条高度 */
  height?: number
  /** 圆形进度条尺寸 */
  circleSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  status: 'default',
  showText: true,
  type: 'line',
  height: 8,
  circleSize: 120
})

const progressStatus = computed(() => {
  if (props.status !== 'default') {
    return props.status
  }
  if (props.percentage === 100) {
    return 'success'
  }
  return undefined
})

const displayText = computed(() => {
  if (props.text) {
    return props.text
  }
  return props.showText ? `${props.percentage}%` : ''
})
</script>

<template>
  <div class="app-progress">
    <n-progress
      :type="type"
      :percentage="percentage"
      :status="progressStatus"
      :show-indicator="showText"
      :height="type === 'line' ? height : undefined"
      :circle-gap="1"
      class="app-progress__bar"
    >
      <template v-if="text || $slots.default" #default>
        <slot>{{ displayText }}</slot>
      </template>
    </n-progress>
  </div>
</template>

<style scoped>
.app-progress {
  width: 100%;
}

.app-progress__bar {
  width: 100%;
}
</style>
