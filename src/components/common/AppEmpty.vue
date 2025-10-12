<!--
  空状态组件
  用于显示列表为空、搜索无结果等场景
-->
<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 空状态描述 */
  description?: string
  /** 图标 */
  icon?: string
  /** 图标大小 */
  size?: number
  /** 按钮文本 */
  buttonText?: string
  /** 是否显示按钮 */
  showButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  description: '暂无数据',
  icon: 'mdi:folder-open-outline',
  size: 120,
  showButton: false
})

const emit = defineEmits<{
  action: []
}>()

const iconSize = computed(() => `${props.size}px`)
</script>

<template>
  <div class="app-empty">
    <div class="app-empty__icon">
      <n-empty :description="description" :size="size" /></div>

    <div class="app-empty__description">
      {{ description }}
    </div>

    <div v-if="showButton && buttonText" class="app-empty__action">
      <n-button @click="emit('action')">
        {{ buttonText }}
      </n-button>
    </div>

    <div v-if="$slots.default" class="app-empty__extra">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.app-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  min-height: 300px;
}

.app-empty__icon {
  margin-bottom: 16px;
  opacity: 0.3;
}

.app-empty__description {
  font-size: 14px;
  color: var(--n-text-color-2);
  margin-bottom: 20px;
}

.app-empty__action {
  margin-bottom: 16px;
}

.app-empty__extra {
  margin-top: 8px;
}
</style>
