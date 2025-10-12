<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { NDrawer, NDrawerContent, NButton, NSpace, NGrid, NGridItem, NStatistic, NAlert, NCard, NSelect, NFormItem } from 'naive-ui';
import AccountConfigForm from './AccountConfigForm.vue';
import QRLoginGrid from './QRLoginGrid.vue';
import LinkLoginGrid from './LinkLoginGrid.vue';
import { useAddAccount } from '@/composables/useAddAccount';
import { dialog } from '@/utils/notification';

interface Props {
  show: boolean;
}

interface Emits {
  (e: 'update:show', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const {
  currentStep,
  accounts,
  isProcessing,
  globalLoginWay, // ✅ 全局上号方式
  successCount,
  failedCount,
  processingCount,
  addAccount,
  removeAccount,
  goNext,
  goBack,
  forceComplete,
  regenerateQRCode,
  retryFailed,
  stopAllRealtimeSubscriptions,
  cleanupUnusedLinks
} = useAddAccount();

// 上号方式选项
const loginWayOptions = ref([
  { label: '链接上号（远程扫码，适合租号）', value: 'permanent_link' },
  { label: '扫码上号（本地扫码，适合自有账号）', value: 'qr_code' }
]);

// 本地 show 状态
const localShow = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
});

// 下一步按钮文本
const nextButtonText = computed(() => {
  switch (currentStep.value) {
    case 0:
      // 根据上号方式显示不同文本
      const hasQR = accounts.value.some(acc => acc.config.loginWay === 'qr_code');
      const hasLink = accounts.value.some(acc => acc.config.loginWay === 'permanent_link');
      if (hasQR && hasLink) {
        return '开始上号';
      } else if (hasLink) {
        return '生成链接';
      } else {
        return '生成二维码';
      }
    case 1:
      return processingCount.value > 0 ? '创建中...' : '完成';
    case 2:
      return '关闭';
    default:
      return '下一步';
  }
});

// 下一步按钮禁用
const nextButtonDisabled = computed(() => {
  if (currentStep.value === 1 && processingCount.value > 0) {
    return true;
  }
  return false;
});

// 处理下一步
async function handleNext() {
  const shouldClose = await goNext();
  if (shouldClose) {
    // 通知父组件刷新列表
    emit('success');
    // 关闭 Drawer
    localShow.value = false;
  }
}

// 计算链接上号的待复制账号数
const linkWaitingCount = computed(() => {
  return accounts.value.filter(
    acc => acc.config.loginWay === 'permanent_link' && acc.state === 'waiting_scan'
  ).length;
});

// 计算扫码上号的处理中账号数
const qrProcessingCount = computed(() => {
  return accounts.value.filter(
    acc => acc.config.loginWay === 'qr_code' &&
    acc.state !== 'config' && acc.state !== 'success' && acc.state !== 'failed'
  ).length;
});

// 计算扫码上号正在创建的账号数
const qrCreatingCount = computed(() => {
  return accounts.value.filter(
    acc => acc.config.loginWay === 'qr_code' &&
    (acc.state === 'creating' || acc.state === 'verifying')
  ).length;
});

// 完成按钮文本
const completeButtonText = computed(() => {
  // 链接上号有等待复制的账号（浏览器已创建，等待发送链接）
  if (linkWaitingCount.value > 0) {
    return '确认完成';
  }
  // 扫码上号有正在创建的账号
  if (qrCreatingCount.value > 0) {
    return `创建中 (${qrCreatingCount.value})`;
  }
  // 扫码上号有等待扫码的账号
  if (qrProcessingCount.value > 0) {
    return '跳过并完成';
  }
  return '完成';
});

// 处理跳过并完成
async function handleSkipAndComplete() {
  // 如果有链接上号的账号等待复制
  if (linkWaitingCount.value > 0) {
    dialog.info({
      title: '确认完成',
      content: `浏览器已创建完成，永久链接已生成。请确保已复制 ${linkWaitingCount.value} 个链接并发送给账号所有者。\n\n账号所有者扫码登录后，Cookie会自动同步到浏览器。您可以在账号列表中查看登录状态。`,
      positiveText: '确认',
      negativeText: '取消',
      onPositiveClick: async () => {
        // 链接上号直接关闭，不进入统计页
        emit('success');
        localShow.value = false;
      }
    });
    return;
  }

  // 如果有扫码上号的账号还在处理中
  if (qrProcessingCount.value > 0) {
    dialog.warning({
      title: '确认跳过',
      content: `当前还有 ${qrProcessingCount.value} 个扫码账号未完成登录，是否跳过这些账号并进入结果页？`,
      positiveText: '确认跳过',
      negativeText: '继续等待',
      onPositiveClick: async () => {
        await forceComplete();
      }
    });
    return;
  }

  // 所有账号都已完成，直接进入结果页
  currentStep.value = 2;
}

// 过滤出扫码上号的账号
const qrCodeAccounts = computed(() => {
  return accounts.value.filter(acc => acc.config.loginWay === 'qr_code');
});

// 过滤出链接上号的账号
const linkAccounts = computed(() => {
  return accounts.value.filter(acc => acc.config.loginWay === 'permanent_link');
});

// 是否有扫码上号的账号
const hasQRCodeAccounts = computed(() => qrCodeAccounts.value.length > 0);

// 是否有链接上号的账号
const hasLinkAccounts = computed(() => linkAccounts.value.length > 0);

// 关闭时重置
watch(localShow, async (val) => {
  if (!val) {
    // ⚠️ 不取消 Realtime 订阅！
    // 链接登录需要持久化订阅，等待用户扫码后 Realtime 推送
    // 订阅会在收到 Cookie 更新后自动取消

    // 只清理未使用的云端链接（没有创建浏览器的链接）
    await cleanupUnusedLinks();

    // 重置所有状态
    currentStep.value = 0;
    globalLoginWay.value = 'permanent_link'; // ✅ 重置全局上号方式
    accounts.value = [
      {
        index: 0,
        config: {
          loginMethod: 'channels_helper',
          loginWay: 'permanent_link',
          proxy: undefined,
          groupId: undefined,
          groupName: undefined,
          remark: ''
        },
        state: 'config',
        progress: 0
      }
    ];
  }
});

// 组件卸载时清理实时订阅和链接
onUnmounted(async () => {
  stopAllRealtimeSubscriptions();
  await cleanupUnusedLinks();
});
</script>

<template>
  <NDrawer
    v-model:show="localShow"
    :width="currentStep === 1 ? 1000 : 600"
    placement="right"
    :close-on-esc="false"
    :mask-closable="false"
  >
    <NDrawerContent title="添加账号" closable>
      <template #header>
        <div class="drawer-header">
          <h3 class="drawer-title">批量添加账号</h3>
        </div>
      </template>

      <!-- 步骤1：配置 -->
      <div v-if="currentStep === 0" class="step-content">
        <!-- 全局上号方式选择 -->
        <div class="global-login-way">
          <!-- 提示信息 -->
          <NAlert
            :type="globalLoginWay === 'permanent_link' ? 'info' : 'success'"
            :bordered="false"
            size="small"
            style="margin-bottom: 12px;"
          >
            <template #icon>
              <icon-mdi:information-outline />
            </template>
            <template v-if="globalLoginWay === 'permanent_link'">
              <strong>链接上号：</strong>适用于租用账号场景，生成永久链接发给账号所有者扫码即可。登录方式由账号所有者在链接页面内自行选择。
            </template>
            <template v-else>
              <strong>扫码上号：</strong>适用于自有账号场景，需要在本地扫码登录。可以选择视频号助手或小店带货助手登录方式。
            </template>
          </NAlert>

          <NFormItem label-placement="left" label-width="100px" label="上号方式">
            <NSelect
              v-model:value="globalLoginWay"
              :options="loginWayOptions"
              placeholder="选择上号方式"
            />
          </NFormItem>
        </div>

        <!-- 账号配置列表 -->
        <NGrid :cols="1" :y-gap="16">
          <NGridItem v-for="account in accounts" :key="account.index">
            <AccountConfigForm
              :account="account"
              :can-remove="accounts.length > 1"
              @remove="removeAccount(account.index)"
            />
          </NGridItem>
        </NGrid>
      </div>

      <!-- 步骤2：登录 -->
      <div v-else-if="currentStep === 1" class="step-content">
        <!-- 扫码上号 -->
        <QRLoginGrid
          v-if="hasQRCodeAccounts"
          :accounts="qrCodeAccounts"
          @regenerate="regenerateQRCode"
        />

        <!-- 链接上号 -->
        <LinkLoginGrid
          v-if="hasLinkAccounts"
          :accounts="linkAccounts"
        />
      </div>

      <!-- 步骤3：完成 -->
      <div v-else-if="currentStep === 2" class="step-content">
        <div class="result-summary">
          <!-- 统计卡片 -->
          <NGrid :cols="2" :x-gap="16" :y-gap="16">
            <NGridItem>
              <NStatistic label="成功创建" :value="successCount">
                <template #prefix>
                  <icon-mdi:check-circle class="success-icon" />
                </template>
              </NStatistic>
            </NGridItem>
            <NGridItem>
              <NStatistic label="未完成" :value="failedCount">
                <template #prefix>
                  <icon-mdi:alert-circle class="failed-icon" />
                </template>
              </NStatistic>
            </NGridItem>
          </NGrid>

          <!-- 成功提示 -->
          <NAlert v-if="successCount > 0" type="success" :show-icon="true">
            成功创建 {{ successCount }} 个账号！可以在账号列表中查看
          </NAlert>

          <!-- 失败和跳过的账号列表 -->
          <div v-if="failedCount > 0" class="failed-list">
            <h4 class="failed-title">未完成的账号：</h4>
            <div class="failed-items">
              <NAlert
                v-for="account in accounts.filter(a => a.state === 'failed')"
                :key="account.index"
                :type="account.errorMsg === '用户跳过' ? 'warning' : 'error'"
                :show-icon="true"
              >
                <template #header>
                  账号 #{{ account.index + 1 }}
                  <span v-if="account.config.remark"> - {{ account.config.remark }}</span>
                </template>
                {{ account.errorMsg || '创建失败' }}
                <template #action>
                  <NButton
                    v-if="account.errorMsg !== '用户跳过'"
                    size="small"
                    type="primary"
                    @click="retryFailed(account.index)"
                  >
                    重试
                  </NButton>
                </template>
              </NAlert>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <template #footer>
        <NSpace justify="space-between">
          <!-- 左侧按钮 -->
          <div>
            <NButton
              v-if="currentStep > 0 && currentStep < 2"
              @click="goBack"
              :disabled="isProcessing"
            >
              上一步
            </NButton>
          </div>

          <!-- 右侧按钮 -->
          <NSpace>
            <!-- 步骤0：添加账号按钮 -->
            <NButton
              v-if="currentStep === 0"
              @click="addAccount"
              :disabled="accounts.length >= 10"
              size="medium"
            >
              <template #icon>
                <icon-mdi:plus />
              </template>
              增加账号 ({{ accounts.length }}/10)
            </NButton>

            <!-- 步骤1显示完成按钮 -->
            <NButton
              v-if="currentStep === 1"
              @click="handleSkipAndComplete"
              :type="linkWaitingCount > 0 ? 'primary' : 'default'"
              :disabled="qrCreatingCount > 0"
              :loading="qrCreatingCount > 0"
            >
              <template #icon>
                <icon-mdi:check-circle v-if="linkWaitingCount > 0" />
                <icon-mdi:skip-next v-else-if="qrProcessingCount > 0" />
              </template>
              {{ completeButtonText }}
            </NButton>

            <!-- 主要操作按钮 -->
            <NButton
              v-if="currentStep === 0 || currentStep === 2"
              type="primary"
              @click="handleNext"
              :disabled="nextButtonDisabled"
              :loading="isProcessing"
            >
              {{ nextButtonText }}
            </NButton>
          </NSpace>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped lang="scss">
.drawer-header {
  .drawer-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: #1f1f1f;
  }
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.global-login-way {
  margin-bottom: 16px;

  :deep(.n-form-item) {
    margin-bottom: 0;
  }
}

.result-summary {
  display: flex;
  flex-direction: column;
  gap: 24px;

  .success-icon {
    color: #52c41a;
    font-size: 24px;
  }

  .failed-icon {
    color: #ff4d4f;
    font-size: 24px;
  }

  .failed-list {
    .failed-title {
      font-size: 16px;
      font-weight: 500;
      margin: 0 0 12px 0;
      color: #ff4d4f;
    }

    .failed-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  }
}

// 深色模式适配
html.dark {
  .drawer-header {
    .drawer-title {
      color: #ddd;
    }
  }

  .result-summary {
    .failed-title {
      color: #ff7875;
    }
  }
}
</style>
