<!--
  确认对话框组件
  用于二次确认操作
-->
<script setup lang="ts">
import { ref } from 'vue'
import type { DialogOptions } from 'naive-ui'

interface Props {
  /** 对话框标题 */
  title?: string
  /** 内容 */
  content?: string
  /** 确认按钮文字 */
  positiveText?: string
  /** 取消按钮文字 */
  negativeText?: string
  /** 类型 */
  type?: 'default' | 'info' | 'success' | 'warning' | 'error'
  /** 是否显示图标 */
  showIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '确认操作',
  content: '确定要执行此操作吗？',
  positiveText: '确定',
  negativeText: '取消',
  type: 'warning',
  showIcon: true
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const showDialog = ref(false)

function open() {
  showDialog.value = true
}

function close() {
  showDialog.value = false
}

function handlePositiveClick() {
  emit('confirm')
  close()
}

function handleNegativeClick() {
  emit('cancel')
  close()
}

// 暴露方法给父组件
defineExpose({
  open,
  close
})
</script>

<template>
  <n-modal
    v-model:show="showDialog"
    preset="dialog"
    :title="title"
    :positive-text="positiveText"
    :negative-text="negativeText"
    :type="type"
    :show-icon="showIcon"
    @positive-click="handlePositiveClick"
    @negative-click="handleNegativeClick"
  >
    <slot>
      {{ content }}
    </slot>
  </n-modal>
</template>

<style scoped>
/* 样式继承自 NaiveUI Dialog */
</style>
