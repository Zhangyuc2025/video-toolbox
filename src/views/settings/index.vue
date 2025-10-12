<template>
  <div class="settings-page">
    <NScrollbar class="settings-scrollbar">
      <div class="settings-container">
        <!-- 账号筛选设置 -->
        <div class="setting-group">
          <h3 class="group-title">账号筛选</h3>

          <div class="setting-card">
            <div class="card-icon">
              <icon-mdi:filter />
            </div>
            <div class="card-content">
              <div class="card-title">只看我的账号</div>
              <div class="card-desc">只显示我创建的浏览器窗口（根据用户名筛选）</div>
            </div>
            <div class="card-control">
              <NSwitch v-model:value="accountFilterForm.filterMyAccounts" />
            </div>
          </div>

          <div v-if="accountFilterForm.filterMyAccounts" class="setting-card">
            <div class="card-icon">
              <icon-mdi:account />
            </div>
            <div class="card-content">
              <div class="card-title">
                比特浏览器用户名
                <span class="required-mark">*</span>
              </div>
              <div class="card-desc">用于筛选您创建的浏览器（createdName 字段），必填项</div>
            </div>
            <div class="card-control">
              <NInput
                v-model:value="accountFilterForm.userName"
                placeholder="请输入用户名（必填）"
                clearable
                style="width: 240px;"
              />
            </div>
          </div>
        </div>

        <!-- API 设置 -->
        <div class="setting-group">
          <h3 class="group-title">API 设置</h3>

          <div class="setting-card">
            <div class="card-icon">
              <icon-mdi:api />
            </div>
            <div class="card-content">
              <div class="card-title">BitBrowser API 会员模式</div>
              <div class="card-desc">
                会员模式：8 请求/秒 | 非会员模式：2 请求/秒
              </div>
            </div>
            <div class="card-control">
              <NSwitch v-model:value="apiForm.vipMode" @update:value="handleVipModeChange" />
            </div>
          </div>
        </div>

        <!-- 外观设置 -->
        <div class="setting-group">
          <h3 class="group-title">外观</h3>

          <div class="setting-card">
            <div class="card-icon">
              <icon-mdi:palette-outline />
            </div>
            <div class="card-content">
              <div class="card-title">主题配置</div>
              <div class="card-desc">自定义界面颜色、布局等视觉样式</div>
            </div>
            <div class="card-control">
              <NButton @click="handleOpenThemeDrawer">
                <template #icon>
                  <icon-mdi:palette-outline />
                </template>
                主题配置
              </NButton>
            </div>
          </div>
        </div>

        <!-- 关于 -->
        <div class="setting-group">
          <h3 class="group-title">关于</h3>

          <div class="setting-card">
            <div class="card-icon">
              <icon-mdi:information-outline />
            </div>
            <div class="card-content">
              <div class="card-title">版本信息</div>
              <div class="card-desc">当前版本：{{ appVersion }}</div>
            </div>
            <div class="card-control">
              <NButton
                type="primary"
                :loading="checkingUpdate"
                :disabled="checkingUpdate"
                @click="handleCheckUpdate"
              >
                <template #icon>
                  <icon-mdi:cloud-download-outline />
                </template>
                {{ checkingUpdate ? '检查中...' : '检查更新' }}
              </NButton>
            </div>
          </div>
        </div>
      </div>
    </NScrollbar>

    <!-- 更新进度对话框 -->
    <NModal v-model:show="showUpdateModal" :mask-closable="false">
      <NCard
        style="width: 500px;"
        title="应用更新"
        :bordered="false"
        size="huge"
        role="dialog"
        aria-modal="true"
      >
        <div class="update-modal-content">
          <div v-if="updateStep === 'checking'" class="update-step">
            <NSpin size="medium" />
            <p class="update-message">正在检查更新...</p>
          </div>

          <div v-else-if="updateStep === 'found'" class="update-step">
            <div class="update-info">
              <icon-mdi:new-box class="update-icon success" />
              <h3>发现新版本：{{ updateInfo?.latestVersion }}</h3>
              <p class="current-version">当前版本：{{ updateInfo?.currentVersion }}</p>

              <div v-if="updateInfo?.releaseNotes" class="release-notes">
                <h4>更新内容：</h4>
                <div class="notes-content">{{ updateInfo.releaseNotes }}</div>
              </div>

              <p class="update-date" v-if="updateInfo?.releaseDate">
                发布日期：{{ formatDate(updateInfo.releaseDate) }}
              </p>
            </div>
          </div>

          <div v-else-if="updateStep === 'downloading'" class="update-step">
            <NProgress
              type="line"
              :percentage="downloadProgress"
              :indicator-placement="'inside'"
              processing
            />
            <p class="update-message">{{ downloadMessage }}</p>
          </div>

          <div v-else-if="updateStep === 'error'" class="update-step">
            <icon-mdi:alert-circle-outline class="update-icon error" />
            <p class="error-message">{{ errorMessage }}</p>
          </div>
        </div>

        <template #footer>
          <div class="modal-footer">
            <NButton
              v-if="updateStep === 'found'"
              @click="handleCancelUpdate"
            >
              稍后更新
            </NButton>
            <NButton
              v-if="updateStep === 'error'"
              @click="showUpdateModal = false"
            >
              关闭
            </NButton>
            <NButton
              v-if="updateStep === 'found'"
              type="primary"
              @click="handleStartUpdate"
            >
              立即更新
            </NButton>
          </div>
        </template>
      </NCard>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useAppStore } from '@/store/modules/app';
import { useBrowserStore } from '@/store/modules/browser';
import { useMessage } from 'naive-ui';
import { checkForUpdates, downloadAndInstall, getCurrentVersion, type UpdateInfo } from '@/utils/updater';
import { apiLimiter } from '@/utils/api-limiter';
import { configStore } from '@/utils/config-store';

const appStore = useAppStore();
const browserStore = useBrowserStore();
const message = useMessage();

// 账号筛选配置
const accountFilterForm = ref({
  userName: browserStore.currentUserName,
  filterMyAccounts: browserStore.filterMyAccounts
});

// 监听账号筛选配置变化，自动保存到store
watch(() => accountFilterForm.value.userName, (newValue) => {
  browserStore.setCurrentUserName(newValue);
});

watch(() => accountFilterForm.value.filterMyAccounts, (newValue) => {
  browserStore.setFilterMyAccounts(newValue);
});

// API 设置
const apiForm = ref({
  vipMode: true
});

// 处理 VIP 模式切换
async function handleVipModeChange(value: boolean) {
  try {
    await apiLimiter.setVipMode(value);
    const rate = value ? 8 : 2;
    message.success(`已切换到${value ? '会员' : '非会员'}模式（${rate} 请求/秒）`);
  } catch (error: any) {
    console.error('切换 VIP 模式失败:', error);
    message.error('切换失败：' + (error.message || '未知错误'));
    // 恢复原值
    apiForm.value.vipMode = !value;
  }
}

// 打开主题抽屉
function handleOpenThemeDrawer() {
  appStore.openThemeDrawer();
}

// 版本信息
const appVersion = ref('1.0.0');

// 更新相关状态
const checkingUpdate = ref(false);
const showUpdateModal = ref(false);
const updateStep = ref<'checking' | 'found' | 'downloading' | 'error'>('checking');
const updateInfo = ref<UpdateInfo | null>(null);
const downloadProgress = ref(0);
const downloadMessage = ref('');
const errorMessage = ref('');

// 获取当前版本和 API 设置（合并到一个 onMounted）
onMounted(async () => {
  try {
    appVersion.value = await getCurrentVersion();
  } catch (error) {
    console.error('获取版本号失败:', error);
  }

  try {
    apiForm.value.vipMode = await configStore.getBitBrowserVipMode();
  } catch (error) {
    console.error('加载 API 设置失败:', error);
  }
});

// 检查更新
async function handleCheckUpdate() {
  checkingUpdate.value = true;
  showUpdateModal.value = true;
  updateStep.value = 'checking';

  try {
    const info = await checkForUpdates();
    updateInfo.value = info;

    if (info.available) {
      updateStep.value = 'found';
    } else {
      showUpdateModal.value = false;
      message.success('当前已是最新版本');
    }
  } catch (error: any) {
    updateStep.value = 'error';
    errorMessage.value = error.message || '检查更新失败，请稍后重试';
  } finally {
    checkingUpdate.value = false;
  }
}

// 开始更新
async function handleStartUpdate() {
  updateStep.value = 'downloading';
  downloadProgress.value = 0;
  downloadMessage.value = '准备下载...';

  try {
    await downloadAndInstall((progress) => {
      downloadProgress.value = progress;
      if (progress < 30) {
        downloadMessage.value = '正在下载更新包...';
      } else if (progress < 90) {
        downloadMessage.value = `下载中 ${progress}%`;
      } else {
        downloadMessage.value = '安装中，即将重启应用...';
      }
    });

    // 应用会自动重启，这里不需要额外处理
  } catch (error: any) {
    updateStep.value = 'error';
    errorMessage.value = error.message || '更新失败，请稍后重试';
  }
}

// 取消更新
function handleCancelUpdate() {
  showUpdateModal.value = false;
  updateStep.value = 'checking';
}

// 格式化日期
function formatDate(dateString: string) {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}
</script>

<style scoped lang="scss">
.settings-page {
  height: 100%;
}

.settings-scrollbar {
  height: 100%;
}

.settings-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

.setting-group {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.group-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--n-text-color);
  margin: 0 0 12px 0;
  padding-left: 4px;
}

.setting-card {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  margin-bottom: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    border-color: var(--n-border-color-hover);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.action-card {
    padding: 12px 20px;
    background: transparent;
    border: none;
    box-shadow: none;

    &:hover {
      box-shadow: none;
    }
  }
}

.card-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--n-text-color-2);
  margin-right: 16px;
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--n-text-color);
  margin-bottom: 4px;
  line-height: 1.4;

  .required-mark {
    color: #ff4d4f;
    margin-left: 4px;
  }
}

.card-desc {
  font-size: 12px;
  color: var(--n-text-color-3);
  line-height: 1.5;
  word-break: break-all;
}

.card-control {
  flex-shrink: 0;
  margin-left: 16px;
}

.card-actions {
  display: flex;
  gap: 8px;
  width: 100%;
}

/* 响应式 */
@media (max-width: 768px) {
  .settings-container {
    padding: 16px;
  }

  .setting-card {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;

    &.action-card {
      padding: 8px 16px;
    }
  }

  .card-icon {
    margin-right: 0;
    margin-bottom: 12px;
  }

  .card-content {
    margin-bottom: 12px;
  }

  .card-control {
    width: 100%;
    margin-left: 0;

    .n-input,
    .n-input-number {
      width: 100% !important;
    }
  }

  .card-actions {
    flex-direction: column;

    .n-button {
      width: 100%;
    }
  }
}

/* 深色模式适配 */
html.dark {
  .setting-card {
    background: #18181c;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    }
  }
}

/* 更新对话框样式 */
.update-modal-content {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.update-step {
  width: 100%;
  text-align: center;
}

.update-message {
  margin-top: 16px;
  font-size: 14px;
  color: var(--n-text-color-2);
}

.update-info {
  text-align: center;

  h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--n-text-color);
    margin: 16px 0 8px;
  }

  .current-version {
    font-size: 13px;
    color: var(--n-text-color-3);
    margin-bottom: 16px;
  }

  .release-notes {
    text-align: left;
    margin: 16px 0;
    padding: 12px;
    background: var(--n-color-target);
    border-radius: 6px;
    border: 1px solid var(--n-border-color);

    h4 {
      font-size: 14px;
      font-weight: 500;
      margin: 0 0 8px 0;
      color: var(--n-text-color);
    }

    .notes-content {
      font-size: 13px;
      line-height: 1.6;
      color: var(--n-text-color-2);
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  .update-date {
    font-size: 12px;
    color: var(--n-text-color-3);
    margin-top: 8px;
  }
}

.update-icon {
  font-size: 48px;
  margin-bottom: 16px;

  &.success {
    color: #18a058;
  }

  &.error {
    color: #d03050;
  }
}

.error-message {
  margin-top: 16px;
  font-size: 14px;
  color: #d03050;
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
