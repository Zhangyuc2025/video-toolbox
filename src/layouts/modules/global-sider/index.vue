<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { invoke } from '@tauri-apps/api';
import { listen } from '@tauri-apps/api/event';
import { GLOBAL_SIDER_MENU_ID } from '@/constants/app';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import { useDialog } from 'naive-ui';
import GlobalLogo from '../global-logo/index.vue';
import MenuToggler from '@/components/common/menu-toggler.vue';

defineOptions({
  name: 'GlobalSider'
});

const appStore = useAppStore();
const themeStore = useThemeStore();
const dialog = useDialog();

const isVerticalMix = computed(() => themeStore.layout.mode === 'vertical-mix');
const isHorizontalMix = computed(() => themeStore.layout.mode === 'horizontal-mix');
const darkMenu = computed(() => !themeStore.darkMode && !isHorizontalMix.value && themeStore.sider.inverted);
const showLogo = computed(() => !isVerticalMix.value && !isHorizontalMix.value);
const menuWrapperClass = computed(() => (showLogo.value ? 'flex-1-hidden' : 'flex-1'));

// BitBrowser 连接状态（后台监控任务推送）
const status = ref({ connected: false, message: '' });
let unlisten: (() => void) | null = null;

// 记录已经显示过的端口占用弹窗（避免重复弹窗）
const shownPortOccupiedDialog = ref(false);

// 组件挂载时监听后台状态事件
onMounted(async () => {
  // 监听后台监控任务推送的状态（后台会立即推送第一次检测结果）
  unlisten = await listen<{ connected: boolean; message: string; timestamp: number; reason?: any }>(
    'bitbrowser-status',
    (event) => {
      status.value.connected = event.payload.connected;
      status.value.message = event.payload.message;

      // 检测到端口被占用的情况
      if (!event.payload.connected && event.payload.reason) {
        const reason = event.payload.reason;

        // 如果是端口被占用，且尚未显示弹窗
        if (reason.type === 'port_occupied' && reason.data && !shownPortOccupiedDialog.value) {
          shownPortOccupiedDialog.value = true;

          const processName = reason.data.process_name || '未知进程';
          const processId = reason.data.process_id;

          dialog.warning({
            title: '端口被占用',
            content: `端口 54345 被进程 "${processName}" (PID: ${processId}) 占用。\n\n是否关闭该进程以释放端口？`,
            positiveText: '关闭进程',
            negativeText: '取消',
            onPositiveClick: async () => {
              try {
                const result = await invoke('kill_process_by_pid', { pid: processId });
                if (result.success) {
                  window.$message?.success('进程已关闭，您现在可以启动 BitBrowser');
                  // 重置标志，允许再次检测
                  shownPortOccupiedDialog.value = false;
                } else {
                  window.$message?.error(result.message || '关闭进程失败');
                  shownPortOccupiedDialog.value = false;
                }
              } catch (error) {
                window.$message?.error('关闭进程失败');
                shownPortOccupiedDialog.value = false;
              }
            },
            onNegativeClick: () => {
              // 用户取消，重置标志
              shownPortOccupiedDialog.value = false;
            }
          });
        }
      } else if (event.payload.connected) {
        // 连接成功时重置标志
        shownPortOccupiedDialog.value = false;
      }
    }
  );
});

// 组件卸载时清理监听器
onBeforeUnmount(() => {
  if (unlisten) {
    unlisten();
  }
});

// 启动 BitBrowser
const launching = ref(false);
async function handleLaunch() {
  launching.value = true;
  try {
    const result = await invoke('launch_bitbrowser', { path: null });
    if (result.success) {
      // 根据返回消息判断是已经运行还是正在启动
      if (result.message && result.message.includes('已经在运行')) {
        window.$message?.info(result.message);
      } else {
        window.$message?.success(result.message || 'BitBrowser 正在启动，请稍候 20-30 秒...');
      }
      // 后台监控任务会自动检测连接状态
    } else {
      window.$message?.error(result.message);
    }
  } catch (error) {
    window.$message?.error('启动失败');
  } finally {
    launching.value = false;
  }
}

// 临时测试：直接调用 API
async function testApiDirect() {
  console.log('开始测试 BitBrowser API...');
  try {
    const result = await invoke('test_bitbrowser_api_direct');
    console.log('✓ 测试结果:', result);
    if (result.success) {
      window.$message?.success('API 测试成功！状态码: ' + result.data.status_code);
    } else {
      window.$message?.error('API 测试失败: ' + result.message);
    }
  } catch (error) {
    console.error('✗ 测试失败:', error);
    window.$message?.error('测试调用失败');
  }
}

// 暴露到 window 以便在控制台调用
(window as any).testBitBrowserApi = testApiDirect;
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
        <div class="status-dot connected"></div>
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
