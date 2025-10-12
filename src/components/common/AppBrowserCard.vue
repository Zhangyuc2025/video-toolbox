<!--
  浏览器卡片组件
  用于展示浏览器信息
-->
<script setup lang="ts">
import { computed } from 'vue'
import AppStatus from './AppStatus.vue'
import AppCard from './AppCard.vue'

interface Props {
  /** 浏览器信息 */
  browser: Browser.BrowserInfo
  /** 是否显示操作按钮 */
  showActions?: boolean
  /** 是否可选中 */
  selectable?: boolean
  /** 是否已选中 */
  selected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
  selectable: false,
  selected: false
})

const emit = defineEmits<{
  open: []
  close: []
  delete: []
  select: [selected: boolean]
  click: []
}>()

const statusType = computed(() => {
  return props.browser.isRunning ? 'success' : 'default'
})

const statusText = computed(() => {
  return props.browser.isRunning ? '运行中' : '已停止'
})
</script>

<template>
  <AppCard
    :hoverable="true"
    class="app-browser-card"
    :class="{
      'app-browser-card--selected': selected
    }"
    @click="emit('click')"
  >
    <template #header>
      <div class="app-browser-card__header">
        <n-checkbox
          v-if="selectable"
          :checked="selected"
          @update:checked="emit('select', $event)"
          @click.stop
        />
        <div class="app-browser-card__title">
          <n-ellipsis style="max-width: 200px">
            {{ browser.name }}
          </n-ellipsis>
        </div>
        <AppStatus :type="statusType" :text="statusText" size="small" dot />
      </div>
    </template>

    <div class="app-browser-card__content">
      <div class="app-browser-card__item">
        <span class="app-browser-card__label">ID:</span>
        <n-ellipsis class="app-browser-card__value">{{ browser.id }}</n-ellipsis>
      </div>

      <div v-if="browser.remark" class="app-browser-card__item">
        <span class="app-browser-card__label">备注:</span>
        <n-ellipsis class="app-browser-card__value">{{ browser.remark }}</n-ellipsis>
      </div>

      <div v-if="browser.proxyType" class="app-browser-card__item">
        <span class="app-browser-card__label">代理:</span>
        <span class="app-browser-card__value">{{ browser.proxyType }}</span>
      </div>
    </div>

    <template v-if="showActions" #footer>
      <div class="app-browser-card__actions">
        <n-button
          v-if="!browser.isRunning"
          size="small"
          type="primary"
          @click.stop="emit('open')"
        >
          打开
        </n-button>
        <n-button
          v-else
          size="small"
          @click.stop="emit('close')"
        >
          关闭
        </n-button>
        <n-button
          size="small"
          quaternary
          type="error"
          @click.stop="emit('delete')"
        >
          删除
        </n-button>
      </div>
    </template>
  </AppCard>
</template>

<style scoped>
.app-browser-card {
  transition: all 0.3s ease;
}

.app-browser-card--selected {
  border-color: var(--n-border-color-active);
  background-color: var(--n-color-target);
}

.app-browser-card__header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-browser-card__title {
  flex: 1;
  font-weight: 500;
}

.app-browser-card__content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.app-browser-card__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.app-browser-card__label {
  color: var(--n-text-color-3);
  min-width: 40px;
}

.app-browser-card__value {
  flex: 1;
  color: var(--n-text-color-2);
}

.app-browser-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
