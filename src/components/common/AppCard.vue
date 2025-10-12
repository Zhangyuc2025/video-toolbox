<!--
  卡片容器组件
  提供统一的卡片布局样式
-->
<script setup lang="ts">
interface Props {
  /** 标题 */
  title?: string
  /** 是否显示分割线 */
  bordered?: boolean
  /** 是否可悬停 */
  hoverable?: boolean
  /** 内边距大小 */
  size?: 'small' | 'medium' | 'large'
  /** 是否显示阴影 */
  shadow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  bordered: true,
  hoverable: false,
  size: 'medium',
  shadow: false
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <n-card
    :title="title"
    :bordered="bordered"
    :hoverable="hoverable"
    :size="size"
    class="app-card"
    :class="{
      'app-card--shadow': shadow
    }"
    @click="emit('click')"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <template v-if="$slots['header-extra']" #header-extra>
      <slot name="header-extra" />
    </template>

    <slot />

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>

    <template v-if="$slots.action" #action>
      <slot name="action" />
    </template>
  </n-card>
</template>

<style scoped>
.app-card {
  width: 100%;
}

.app-card--shadow {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.app-card--shadow:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
</style>
