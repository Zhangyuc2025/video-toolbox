<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { invoke } from '@tauri-apps/api';
import { GLOBAL_SIDER_MENU_ID } from '@/constants/app';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import GlobalLogo from '../global-logo/index.vue';
import MenuToggler from '@/components/common/menu-toggler.vue';

defineOptions({
  name: 'GlobalSider'
});

const appStore = useAppStore();
const themeStore = useThemeStore();

const isVerticalMix = computed(() => themeStore.layout.mode === 'vertical-mix');
const isHorizontalMix = computed(() => themeStore.layout.mode === 'horizontal-mix');
const darkMenu = computed(() => !themeStore.darkMode && !isHorizontalMix.value && themeStore.sider.inverted);
const showLogo = computed(() => !isVerticalMix.value && !isHorizontalMix.value);
const menuWrapperClass = computed(() => (showLogo.value ? 'flex-1-hidden' : 'flex-1'));

// BitBrowser 连接状态检测
const status = ref({ connected: false });
const isMonitoring = ref(false);
let checkInterval: number | null = null;

async function checkBitBrowserStatus() {
  try {
    const response = await invoke<any>('check_bitbrowser_running');
    status.value.connected = response.success;
  } catch (error) {
    status.value.connected = false;
  }
}

// 组件挂载时开始检测
onMounted(async () => {
  await checkBitBrowserStatus();
  // 每 5 秒检测一次
  checkInterval = window.setInterval(checkBitBrowserStatus, 5000);
});

// 组件卸载时清理定时器
onBeforeUnmount(() => {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
});

// 启动 BitBrowser
const launching = ref(false);
async function handleLaunch() {
  launching.value = true;
  try {
    const result = await invoke('launch_bitbrowser', { path: null });
    if (result.success) {
      window.$message?.success('BitBrowser 启动成功');
      // 立即检测一次状态
      await checkBitBrowserStatus();
    } else {
      window.$message?.error(result.message);
    }
  } catch (error) {
    window.$message?.error('启动失败');
  } finally {
    launching.value = false;
  }
}
</script>

<template>
  <DarkModeContainer class="size-full flex-col-stretch shadow-sider" :inverted="darkMenu">
    <!-- 顶部 Logo 和菜单切换 -->
    <div class="flex-y-center" :style="{ height: themeStore.header.height + 'px', padding: '0 12px' }">
      <GlobalLogo
        v-if="showLogo"
        :show-title="!appStore.siderCollapse"
        class="flex-1"
      />
      <MenuToggler :collapsed="appStore.siderCollapse" @click="appStore.toggleSiderCollapse" />
    </div>

    <!-- 菜单区域 -->
    <div :id="GLOBAL_SIDER_MENU_ID" :class="menuWrapperClass"></div>

    <!-- 底部连接状态 -->
    <div class="connection-status" :class="{ collapsed: appStore.siderCollapse }">
      <!-- 已连接状态：显示绿点 + 文字 -->
      <div v-if="status.connected" class="status-indicator">
        <div class="status-dot connected" :class="{ monitoring: isMonitoring }"></div>
        <Transition name="fade" mode="out-in">
          <span v-if="!appStore.siderCollapse" class="status-text">
            BitBrowser 已连接
          </span>
        </Transition>
      </div>

      <!-- 未连接状态：显示红点 + 启动按钮 -->
      <div v-else class="status-indicator">
        <div class="status-dot"></div>
        <div class="launch-button-wrapper">
          <NButton
            v-if="appStore.siderCollapse"
            size="small"
            type="primary"
            :loading="launching"
            circle
            @click="handleLaunch"
          >
            <template #icon>
              <SvgIcon icon="mdi:rocket-launch" />
            </template>
          </NButton>
          <NButton
            v-else
            size="small"
            type="primary"
            :loading="launching"
            @click="handleLaunch"
          >
            <SvgIcon icon="mdi:rocket-launch" class="mr-4px" />
            启动 BitBrowser
          </NButton>
        </div>
      </div>
    </div>
  </DarkModeContainer>
</template>

<style scoped>
.connection-status {
  padding: 12px;
  border-top: 1px solid var(--border-color);
  transition: all 0.3s ease;
}

.connection-status.collapsed {
  padding: 12px 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.launch-button-wrapper {
  flex: 1;
  display: flex;
  justify-content: stretch;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #d03050;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.status-dot.connected {
  background-color: #18a058;
}

.status-dot.monitoring {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  font-size: 12px;
  color: var(--color-text);
  opacity: 0.82;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
