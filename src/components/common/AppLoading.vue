<!--
  加载状态组件
  用于显示加载中状态
-->
<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 加载提示文本 */
  description?: string
  /** 尺寸 */
  size?: 'small' | 'medium' | 'large'
  /** 是否全屏显示 */
  fullscreen?: boolean
  /** 是否显示遮罩 */
  showMask?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  description: '加载中...',
  size: 'medium',
  fullscreen: false,
  showMask: true
})

const sizeMap = {
  small: 24,
  medium: 32,
  large: 48
}

const spinSize = computed(() => sizeMap[props.size])
</script>

<template>
  <div
    class="app-loading"
    :class="{
      'app-loading--fullscreen': fullscreen,
      'app-loading--mask': showMask
    }"
  >
    <div class="app-loading__content">
      <n-spin :size="spinSize" />
      <div v-if="description" class="app-loading__description">
        {{ description }}
      </div>
      <div v-if="$slots.default" class="app-loading__extra">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  min-height: 200px;
}

.app-loading--fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  min-height: 100vh;
}

.app-loading--mask {
  background-color: rgba(255, 255, 255, 0.8);
}

.app-loading__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.app-loading__description {
  font-size: 14px;
  color: var(--n-text-color-2);
}

.app-loading__extra {
  margin-top: 8px;
}
</style>
