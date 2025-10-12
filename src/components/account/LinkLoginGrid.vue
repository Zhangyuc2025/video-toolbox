<script setup lang="ts">
import { computed } from 'vue';
import type { AccountCreateItem } from '@/types/account';

interface Props {
  accounts: AccountCreateItem[];
}

const props = defineProps<Props>();

// 复制链接到剪贴板（参考 AccountCard 的格式）
async function copyLink(account: AccountCreateItem) {
  try {
    const link = account.permanentLink;
    if (!link) return;

    // 组装带账号信息的文本
    let copyText = '';

    // 构建账号标识（优先级：备注 > 分组 > 序号）
    let accountLabel = '';
    if (account.config.remark) {
      // 有备注：直接使用备注
      accountLabel = account.config.remark;
    } else if (account.config.groupName) {
      // 有分组：显示"分组名 - 账号 #N"
      accountLabel = `${account.config.groupName} - 账号 #${account.index + 1}`;
    } else {
      // 默认：只显示序号
      accountLabel = `账号 #${account.index + 1}`;
    }

    // 新号时只显示标识，不显示"账号："前缀（因为标识本身已包含"账号"）
    copyText = `${accountLabel}\n登录链接：${link}\n此链接长期有效，随时获取最新登录二维码，出现微信内打不开的情况复制到浏览器内打开即可`;

    await navigator.clipboard.writeText(copyText);
    window.$message?.success('登录链接已复制到剪贴板');
  } catch (error) {
    console.error('复制失败:', error);
    window.$message?.error('复制失败');
  }
}

// 过滤出使用链接上号的账号
const linkAccounts = computed(() => {
  return props.accounts.filter(acc => acc.config.loginWay === 'permanent_link');
});

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
</script>

<template>
  <div class="link-grid">
    <n-card
      v-for="account in linkAccounts"
      :key="account.index"
      :title="getAccountTitle(account)"
      class="link-card"
    >
      <!-- 永久链接 -->
      <div v-if="account.permanentLink" class="link-section">
        <n-input
          :value="account.permanentLink"
          readonly
          size="large"
        >
          <template #suffix>
            <n-button
              text
              @click="copyLink(account)"
            >
              <template #icon>
                <icon-mdi:content-copy />
              </template>
              复制
            </n-button>
          </template>
        </n-input>

        <!-- 状态 -->
        <div class="status-section">
          <n-alert
            v-if="account.linkStatus === 'synced'"
            type="success"
            :bordered="false"
          >
            <template #icon>
              <icon-mdi:check-circle />
            </template>
            Cookie已同步
            <span v-if="account.accountInfo?.nickname">
              - {{ account.accountInfo.nickname }}
            </span>
          </n-alert>

          <n-alert
            v-else-if="account.state === 'success' && !account.linkStatus"
            type="info"
            :bordered="false"
          >
            <template #icon>
              <n-spin size="small" />
            </template>
            浏览器已创建，等待登录完成...
          </n-alert>

          <n-alert
            v-else-if="account.state === 'waiting_scan'"
            type="warning"
            :bordered="false"
          >
            <template #icon>
              <icon-mdi:link-variant />
            </template>
            请复制链接发送给账号所有者
          </n-alert>

          <n-alert
            v-else-if="account.state === 'failed'"
            type="error"
            :bordered="false"
          >
            <template #icon>
              <icon-mdi:close-circle />
            </template>
            {{ account.errorMsg || '失败' }}
          </n-alert>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-else class="loading-section">
        <n-spin size="medium" />
        <div class="loading-text">正在生成永久链接...</div>
      </div>
    </n-card>
  </div>
</template>

<style scoped lang="scss">
.link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 20px;
  padding: 20px 0;
}

.link-card {
  :deep(.n-card__content) {
    padding: 24px;
  }
}

.link-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-section {
  margin-top: 8px;
}

.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.loading-text {
  margin-top: 16px;
  font-size: 14px;
  color: #999;
}
</style>
