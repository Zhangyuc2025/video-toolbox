<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { NGrid, NGridItem, NCard, NProgress, NButton, NTag, NEmpty, NImage, NSpin } from 'naive-ui';
import type { AccountCreateItem, AccountCreateState } from '@/types/account';
import { LoginMethod } from '@/types/account';

interface Props {
  accounts: AccountCreateItem[];
}

interface Emits {
  (e: 'regenerate', index: number): void;
  (e: 'expire', index: number): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 当前时间戳（用于倒计时计算）
const currentTime = ref(Date.now());
let timer: number | null = null;

// 记录已过期的账号，避免重复触发
const expiredAccounts = new Set<number>();

// 定时更新当前时间
onMounted(() => {
  timer = window.setInterval(() => {
    currentTime.value = Date.now();
    checkExpiredAccounts();
  }, 1000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
  // 清理过期账号记录
  expiredAccounts.clear();
});

// 监听账号数组变化，清理不存在的过期记录
watch(() => props.accounts, (newAccounts) => {
  if (!newAccounts || newAccounts.length === 0) {
    expiredAccounts.clear();
    return;
  }

  // 清理不存在的账号索引
  const validIndexes = new Set(newAccounts.map(acc => acc.index));
  const toDelete: number[] = [];
  expiredAccounts.forEach(index => {
    if (!validIndexes.has(index)) {
      toDelete.push(index);
    }
  });
  toDelete.forEach(index => expiredAccounts.delete(index));
}, { deep: true });

// 检查是否有账号倒计时归零
function checkExpiredAccounts() {
  if (!props.accounts || props.accounts.length === 0) {
    return;
  }

  props.accounts.forEach(account => {
    // 确保账号对象存在且有效
    if (!account) {
      return;
    }

    // 检查等待扫码或已扫码状态的账号
    if ((account.state === 'waiting_scan' || account.state === 'scanned') && account.qrExpireTime) {
      const remaining = getRemainingTime(account);

      // 倒计时归零且未触发过期事件
      if (remaining === 0 && !expiredAccounts.has(account.index)) {
        expiredAccounts.add(account.index);
        emit('expire', account.index);
      }
    }
  });
}

// 计算剩余时间（秒）
function getRemainingTime(account: AccountCreateItem | undefined): number {
  if (!account || !account.qrExpireTime) return 0;
  const remaining = Math.max(0, Math.floor((account.qrExpireTime - currentTime.value) / 1000));
  return remaining;
}

// 格式化剩余时间为 MM:SS
function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// 状态文本映射
const stateTextMap: Record<AccountCreateState, string> = {
  config: '配置中',
  qr_ready: '生成中',
  waiting_scan: '等待扫码',
  scanned: '已扫码',
  verifying: '验证中',
  creating: '创建中',
  success: '创建成功',
  failed: '失败'
};

// 根据登录方式获取二维码提示文本
function getQRTipText(loginMethod: LoginMethod): string {
  switch (loginMethod) {
    case LoginMethod.CHANNELS_HELPER:
      return '微信扫码登录 视频号助手';
    case LoginMethod.SHOP_HELPER:
      return '微信扫码登录 小店带货助手';
    default:
      return '请使用微信扫码登录';
  }
}

// 获取账号标题（包含分组和备注）
function getAccountTitle(account: AccountCreateItem): string {
  let title = `账号 #${account.index + 1}`;

  // 添加分组信息
  if (account.config.groupName) {
    title += ` - ${account.config.groupName}`;
  }

  // 添加备注信息
  if (account.config.remark) {
    title += ` (${account.config.remark})`;
  }

  return title;
}

// 状态标签类型
function getStateTagType(state: AccountCreateState) {
  switch (state) {
    case 'success':
      return 'success';
    case 'failed':
      return 'error';
    case 'waiting_scan':
      return 'warning';
    case 'scanned':
    case 'verifying':
    case 'creating':
      return 'info';
    default:
      return 'default';
  }
}

// 状态图标
function getStateIcon(state: AccountCreateState) {
  switch (state) {
    case 'success':
      return 'mdi:check-circle';
    case 'failed':
      return 'mdi:close-circle';
    case 'waiting_scan':
      return 'mdi:qrcode-scan';
    case 'scanned':
      return 'mdi:check-decagram';
    case 'verifying':
    case 'creating':
      return 'mdi:loading';
    default:
      return 'mdi:information';
  }
}
</script>

<template>
  <div class="qr-login-grid">
    <NGrid :cols="3" :x-gap="16" :y-gap="16" responsive="screen">
      <NGridItem
        v-for="account in accounts"
        :key="account.index"
        :span="accounts.length === 1 ? 3 : accounts.length === 2 ? 3 : 1"
      >
        <NCard
          :title="getAccountTitle(account)"
          size="small"
          :bordered="true"
          class="qr-card"
        >
          <template #header-extra>
            <NTag :type="getStateTagType(account.state)" size="small">
              <template #icon>
                <component :is="`icon-${getStateIcon(account.state)}`" />
              </template>
              <template v-if="account.state === 'waiting_scan' || account.state === 'scanned'">
                {{ stateTextMap[account.state] }} {{ formatRemainingTime(getRemainingTime(account)) }}
              </template>
              <template v-else>
                {{ stateTextMap[account.state] }}
              </template>
            </NTag>
          </template>

          <div class="qr-content">
            <!-- 二维码区域（所有状态都在这个容器内展示） -->
            <div class="qr-code-wrapper">
              <div class="qr-code-container">
                <!-- 二维码图片 -->
                <div class="qr-code-image">
                  <NImage
                    v-if="account.qrUrl"
                    :src="account.qrUrl"
                    :width="200"
                    :height="200"
                    object-fit="contain"
                    :preview-disabled="true"
                  />
                  <!-- 无二维码时显示占位 -->
                  <div v-else class="qr-placeholder">
                    <icon-mdi:qrcode class="placeholder-icon" />
                  </div>
                </div>

                <!-- 底部提示文字 -->
                <div v-if="account.state === 'waiting_scan'" class="qr-tip-overlay">
                  {{ getQRTipText(account.config.loginMethod) }}
                </div>

                <!-- 加载状态遮罩 -->
                <div v-if="account.state === 'qr_ready'" class="qr-mask loading-mask">
                  <NSpin size="large" />
                  <p class="mask-text">生成中...</p>
                </div>

                <!-- 已扫码状态遮罩 -->
                <div v-else-if="account.state === 'scanned'" class="qr-mask scanned-mask">
                  <div class="avatar-wrapper" v-if="account.accountInfo?.avatar">
                    <img :src="account.accountInfo.avatar" class="user-avatar" />
                  </div>
                  <icon-mdi:check-circle v-else class="mask-icon scanned-icon" />
                  <p class="mask-title">已扫码</p>
                  <p class="mask-hint">请在手机上确认登录</p>
                  <p v-if="account.accountInfo?.nickname" class="mask-nickname">
                    {{ account.accountInfo.nickname }}
                  </p>
                </div>

                <!-- 验证中/创建中状态遮罩 -->
                <div v-else-if="account.state === 'verifying' || account.state === 'creating'" class="qr-mask verifying-mask">
                  <NSpin size="large" />
                  <p class="mask-title" style="color: #52c41a; margin-top: 8px;">登录成功</p>
                  <p class="mask-text">{{ account.state === 'verifying' ? '验证中...' : '正在创建浏览器...' }}</p>
                  <p v-if="account.accountInfo?.nickname" class="mask-nickname">
                    {{ account.accountInfo.nickname }}
                  </p>
                </div>

                <!-- 成功状态遮罩 -->
                <div v-else-if="account.state === 'success'" class="qr-mask success-mask">
                  <icon-mdi:check-circle class="mask-icon success-icon" />
                  <p class="mask-title">登录成功</p>
                  <p v-if="account.accountInfo?.nickname" class="mask-nickname">
                    {{ account.accountInfo.nickname }}
                  </p>
                </div>

                <!-- 过期状态遮罩 -->
                <div v-else-if="account.state === 'failed' && account.errorMsg === '二维码已过期'"
                     class="qr-mask expired-mask"
                     @click="emit('regenerate', account.index)">
                  <icon-mdi:refresh class="mask-icon expired-icon" />
                  <p class="mask-title">二维码已过期</p>
                  <p class="mask-hint">点击重新获取</p>
                </div>

                <!-- 其他失败状态 -->
                <div v-else-if="account.state === 'failed'" class="qr-mask failed-mask">
                  <icon-mdi:close-circle class="mask-icon failed-icon" />
                  <p class="mask-title">{{ account.errorMsg || '登录失败' }}</p>
                  <NButton
                    type="primary"
                    size="small"
                    @click="emit('regenerate', account.index)"
                    style="margin-top: 12px;"
                  >
                    重新生成
                  </NButton>
                </div>
              </div>
            </div>

            <!-- 备注信息 -->
            <div v-if="account.config.remark" class="remark">
              <icon-mdi:note-text class="remark-icon" />
              {{ account.config.remark }}
            </div>
          </div>
        </NCard>
      </NGridItem>
    </NGrid>

    <!-- 空状态 -->
    <NEmpty v-if="accounts.length === 0" description="暂无账号" />
  </div>
</template>

<style scoped lang="scss">
.qr-login-grid {
  padding: 16px 0;
}

.qr-card {
  height: 100%;

  :deep(.n-card-header) {
    padding: 12px 16px;
  }

  :deep(.n-card__content) {
    padding: 16px;
  }
}

.qr-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-height: 280px;
}

.qr-code-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;

  .qr-code-container {
    position: relative;
    width: 216px;
    height: 246px; // 增加高度给底部文字留空间
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 8px;
    padding-bottom: 34px; // 底部留出文字空间
    background: white;
    overflow: hidden;
  }

  .qr-code-image {
    width: 200px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qr-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fafafa;
    border-radius: 4px;
  }

  .placeholder-icon {
    font-size: 80px;
    color: #d9d9d9;
  }

  .qr-tip-overlay {
    position: absolute;
    bottom: 8px;
    left: 8px;
    right: 8px;
    padding: 4px 8px;
    font-size: 12px;
    color: #666;
    text-align: center;
    background: rgba(255, 255, 255, 0.98);
    border-radius: 4px;
    z-index: 1;
  }

  // 统一遮罩样式
  .qr-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.96);
    z-index: 2;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .mask-icon {
    font-size: 56px;
    margin-bottom: 4px;
  }

  .mask-title {
    font-size: 16px;
    font-weight: 500;
    margin: 0;
  }

  .mask-hint {
    font-size: 13px;
    color: #999;
    margin: 0;
  }

  .mask-text {
    font-size: 14px;
    color: #666;
    margin: 0;
    margin-top: 8px;
  }

  .mask-nickname {
    font-size: 13px;
    color: #666;
    margin: 4px 0 0 0;
  }

  // 用户头像
  .avatar-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    margin-bottom: 4px;
    border: 2px solid #1890ff;
  }

  .user-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  // 不同状态的颜色
  .scanned-mask {
    .scanned-icon {
      color: #1890ff;
    }
    .mask-title {
      color: #1890ff;
    }
  }

  .success-mask {
    .success-icon {
      color: #52c41a;
    }
    .mask-title {
      color: #52c41a;
    }
  }

  .expired-mask {
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      background: rgba(240, 248, 255, 0.96);
    }

    .expired-icon {
      color: #999;
      transition: color 0.3s ease;
    }

    &:hover .expired-icon {
      color: #40a9ff;
    }

    .mask-title {
      color: #666;
    }

    .mask-hint {
      color: #40a9ff;
    }
  }

  .failed-mask {
    .failed-icon {
      color: #ff4d4f;
    }
    .mask-title {
      color: #ff4d4f;
    }
  }

  .loading-mask, .verifying-mask {
    .mask-text {
      color: #666;
    }
  }
}

.remark {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #999;
  margin-top: auto;

  .remark-icon {
    font-size: 14px;
  }
}
</style>
