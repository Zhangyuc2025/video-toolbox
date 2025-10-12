<script setup lang="ts">
import { computed, ref, h } from 'vue';
import { NButton, NCard, NSpace, NTag, NAvatar, NTooltip, NCollapse, NCollapseItem, NIcon, NDropdown } from 'naive-ui';
import type { Browser } from '@/types/browser';
import { useBrowserStore } from '@/store/modules/browser';
import { AccountMonitorService } from '@/services/account-monitor';
import { CloudService } from '@/services/cloud';
import AccountDetailDrawer from './AccountDetailDrawer.vue';
import type { DropdownOption } from 'naive-ui';

interface Props {
  browser: Browser;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  open: [browserId: string];
  close: [browserId: string];
  delete: [browserId: string];
  checkCookie: [browserId: string];
}>();

const browserStore = useBrowserStore();

// 详情抽屉显示状态
const showDetailDrawer = ref(false);

// 计算运行状态
const isRunning = computed(() => browserStore.isBrowserRunning(props.browser.id));

// 获取云端Cookie状态（唯一数据源）
const cloudCookieStatus = computed(() => {
  return AccountMonitorService.getAccountStatus(props.browser.id);
});

// 计算账号信息（优先云端 Realtime 数据）
const accountInfo = computed(() => {
  // 优先：云端 Realtime 数据
  const cloudStatus = cloudCookieStatus.value;
  if (cloudStatus?.accountInfo) {
    return {
      nickname: cloudStatus.accountInfo.nickname,
      headImgUrl: cloudStatus.accountInfo.avatar || '',
      accountState: 0 // 云端暂无此字段，默认正常
    };
  }

  // 后备：本地数据
  const localInfo = browserStore.getAccountInfo(props.browser.id);
  if (localInfo) {
    return {
      nickname: localInfo.nickname,
      headImgUrl: (localInfo as any).avatar || localInfo.headImgUrl || '',
      accountState: localInfo.accountState || 0
    };
  }

  return null;
});

// 计算Cookie检测状态
const isCheckingCookie = computed(() => browserStore.isCookieChecking(props.browser.id));

// 运行状态文本和颜色
const runningStatus = computed(() => {
  if (isRunning.value) {
    return { text: '运行中', type: 'success' as const };
  }
  return { text: '未运行', type: 'default' as const };
});

// Cookie状态文本和颜色（使用云端状态）
const cookieStatusInfo = computed(() => {
  const cloudStatus = cloudCookieStatus.value;

  // 无云端状态 → 未登录
  if (!cloudStatus || !cloudStatus.cookieStatus) {
    return { text: '未登录', type: 'warning' as const, isValid: false };
  }

  // 4种标准状态
  switch (cloudStatus.cookieStatus) {
    case 'online':
      return { text: '在线', type: 'success' as const, isValid: true };
    case 'offline':
      return { text: '掉线', type: 'error' as const, isValid: false };
    case 'checking':
      return { text: '检测中', type: 'info' as const, isValid: false };
    case 'pending':
      return { text: '未登录', type: 'warning' as const, isValid: false };
  }
});

// 在线时长（基于loginTime计算）
const onlineTime = computed(() => {
  const cloudStatus = cloudCookieStatus.value;
  const localAccount = browserStore.getAccountInfo(props.browser.id);

  // 未登录或检测中：不显示
  if (!cloudStatus || cloudStatus.cookieStatus === 'pending' || cloudStatus.cookieStatus === 'checking') {
    return null;
  }

  const loginTime = localAccount?.loginTime;
  if (!loginTime) return null;

  let endTime: number;
  let prefix: string;

  // 在线：显示本次登录的累计时长
  if (cloudStatus.cookieStatus === 'online') {
    endTime = Date.now();
    prefix = '本次';
  }
  // 掉线：显示上次登录的累计时长
  else if (cloudStatus.cookieStatus === 'offline' && cloudStatus.cookieExpiredAt) {
    endTime = new Date(cloudStatus.cookieExpiredAt).getTime();
    prefix = '上次';
  }
  else {
    return null;
  }

  const hours = ((endTime - loginTime) / (1000 * 60 * 60)).toFixed(1);
  return `${prefix} ${hours} 小时`;
});

// 代理信息文本
const proxyInfo = computed(() => {
  const { proxyType, host, port } = props.browser;
  if (!proxyType || proxyType === 'noproxy') {
    return '本地直连';
  }
  return `${proxyType.toUpperCase()} ${host}:${port}`;
});

// 简洁的代理显示
const proxyShort = computed(() => {
  const { proxyType } = props.browser;
  if (!proxyType || proxyType === 'noproxy') {
    return '本地直连';
  }
  return proxyType.toUpperCase();
});

// 计算登录方式（优先云端 Realtime 数据）
const loginMethod = computed(() => {
  // 优先：云端 Realtime 数据
  const cloudStatus = cloudCookieStatus.value;
  if (cloudStatus?.accountInfo?.loginMethod) {
    return cloudStatus.accountInfo.loginMethod;
  }

  // 后备：本地数据
  const localInfo = browserStore.getAccountInfo(props.browser.id);
  return localInfo?.loginMethod || null;
});

// 格式化登录方式文本
const loginMethodText = computed(() => {
  if (!loginMethod.value) return '等待登录';

  return loginMethod.value === 'channels_helper'
    ? '视频号登录'
    : '带货助手登录';
});

// Badge状态点颜色
const badgeColor = computed(() => {
  if (isRunning.value) return '#18a058'; // 绿色：运行中
  if (cloudCookieStatus.value?.cookieStatus === 'online') return '#2080f0'; // 蓝色：Cookie有效
  return '#d0d0d0'; // 灰色：离线
});

// 处理打开浏览器
const handleOpen = () => {
  if (!isRunning.value) {
    emit('open', props.browser.id);
  }
};

// 处理关闭浏览器
const handleClose = () => {
  if (isRunning.value) {
    emit('close', props.browser.id);
  }
};

// 处理删除浏览器
const handleDelete = () => {
  emit('delete', props.browser.id);
};

// 处理检测Cookie
const handleCheckCookie = () => {
  emit('checkCookie', props.browser.id);
};

// 处理复制登录链接
const handleCopyLoginLink = async () => {
  try {
    const loginUrl = CloudService.getLoginUrl(props.browser.id);

    // 如果有账号信息，组装带账号名称的文本
    let copyText = '';
    if (accountInfo.value?.nickname) {
      copyText = `账号：${accountInfo.value.nickname}\n登录链接：${loginUrl}\n此链接长期有效，随时获取最新登录二维码，出现微信内打不开的情况复制到浏览器内打开即可`;
    } else {
      copyText = `登录链接：${loginUrl}\n此链接长期有效，随时获取最新登录二维码，出现微信内打不开的情况复制到浏览器内打开即可`;
    }

    await navigator.clipboard.writeText(copyText);
    window.$message?.success('登录链接已复制到剪贴板');
  } catch (error) {
    console.error('复制登录链接失败:', error);
    window.$message?.error('复制失败');
  }
};

// 处理点击头像/名字，打开详情
const handleShowDetail = () => {
  showDetailDrawer.value = true;
};

// 下拉菜单选项
const dropdownOptions = computed<DropdownOption[]>(() => [
  {
    label: '复制链接',
    key: 'copy-link',
    icon: () => h(NIcon, null, { default: () => h('icon-mdi:link-variant') })
  },
  {
    type: 'divider',
    key: 'divider'
  },
  {
    label: '删除',
    key: 'delete',
    icon: () => h(NIcon, null, { default: () => h('icon-mdi:delete') }),
    disabled: isRunning.value
  }
]);

// 处理下拉菜单选择
const handleDropdownSelect = (key: string) => {
  switch (key) {
    case 'copy-link':
      handleCopyLoginLink();
      break;
    case 'delete':
      handleDelete();
      break;
  }
};
</script>

<template>
  <NCard
    size="small"
    hoverable
    :segmented="{ content: true }"
    class="slack-account-card"
  >
    <div class="card-content">
      <!-- 头像 + 名字 -->
      <div class="row-main">
        <!-- 可点击区域：头像 + 名字 -->
        <div class="clickable-area" @click="handleShowDetail">
          <div class="avatar-section">
            <NAvatar
              v-if="accountInfo"
              :src="accountInfo.headImgUrl"
              :size="36"
              round
              fallback-src="https://07akioni.oss-cn-beijing.aliyuncs.com/07akioni.jpeg"
            />
            <NAvatar v-else :size="36" round>
              <NIcon :size="18">
                <icon-mdi:account />
              </NIcon>
            </NAvatar>
            <div class="status-dot" :style="{ backgroundColor: badgeColor }"></div>
          </div>

          <span class="nickname">{{ accountInfo?.nickname || browser.name }}</span>
        </div>

        <!-- 徽章标签（不可点击） -->
        <NTag
          v-if="accountInfo"
          type="default"
          size="tiny"
          :bordered="false"
          class="account-badge"
        >
          未知
        </NTag>
      </div>

      <!-- 详细信息区域 -->
      <div class="info-section">
        <!-- 第二行：详细信息 + 在线状态 + 在线时长 -->
        <div class="detail-row">
          <span class="detail-text">{{ loginMethodText }}</span>
          <template v-if="browser.remark">
            <span class="separator">·</span>
            <span class="detail-text">{{ browser.remark }}</span>
          </template>
          <span class="separator">·</span>
          <NTag
            :type="cookieStatusInfo.type"
            size="tiny"
            :bordered="false"
            class="status-badge"
          >
            {{ cookieStatusInfo.text }}
          </NTag>
          <template v-if="onlineTime">
            <span class="separator">·</span>
            <span class="detail-text">{{ onlineTime }}</span>
          </template>
        </div>

        <!-- 第三行：次要信息 -->
        <div class="meta-row">
          <span v-if="browser.groupName" class="meta-text">{{ browser.groupName }}</span>
          <span v-if="browser.groupName" class="separator">·</span>
          <span class="meta-text">{{ proxyShort }}</span>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="actions-section">
        <!-- 主操作：打开/关闭浏览器 -->
        <NButton
          size="small"
          :type="isRunning ? 'warning' : 'primary'"
          :disabled="!isRunning && !cookieStatusInfo.isValid"
          @click="isRunning ? handleClose() : handleOpen()"
          class="primary-action"
        >
          <template #icon>
            <icon-mdi:stop v-if="isRunning" />
            <icon-mdi:play v-else />
          </template>
          {{ isRunning ? '关闭' : (cookieStatusInfo.isValid ? `打开 #${browser.seq}` : `请重新登录 #${browser.seq}`) }}
        </NButton>

        <!-- 次要操作：溢出菜单 -->
        <NDropdown
          trigger="click"
          :options="dropdownOptions"
          @select="handleDropdownSelect"
        >
          <NButton
            size="small"
            quaternary
            class="more-actions"
          >
            <template #icon>
              <icon-mdi:dots-vertical />
            </template>
          </NButton>
        </NDropdown>
      </div>
    </div>

    <!-- 账号详情抽屉 -->
    <AccountDetailDrawer
      v-model:show="showDetailDrawer"
      :browser="browser"
    />
  </NCard>
</template>

<style scoped lang="scss">
.slack-account-card {
  .card-content {
    padding: 0;
  }

  // 头像 + 名字行
  .row-main {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  // 可点击区域：头像 + 名字
  .clickable-area {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
    padding: 4px;
    margin: -4px;
    border-radius: 8px;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }

    &:active {
      background-color: rgba(0, 0, 0, 0.08);
    }

    .nickname {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  // 头像区域
  .avatar-section {
    position: relative;
    flex-shrink: 0;

    .status-dot {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid #fff;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
    }
  }

  // 详细信息区域
  .info-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }

  // 第二行：详细信息（登录方式、时长）+ 在线状态标签
  .detail-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #616161;
    flex-wrap: wrap;

    .detail-text {
      white-space: nowrap;
    }

    .separator {
      color: #9e9e9e;
    }
  }

  // 第三行：次要信息（代理、分组）
  .meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #9e9e9e;

    .meta-text {
      white-space: nowrap;
    }

    .separator {
      color: #bdbdbd;
    }
  }

  // 底部操作按钮区域
  .actions-section {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid #f0f0f0;

    // 主操作按钮（打开/关闭）
    .primary-action {
      flex: 1;  // 占据剩余空间
      min-width: 0;  // 允许压缩
    }

    // 溢出菜单按钮（更多操作）
    .more-actions {
      flex-shrink: 0;  // 保持固定宽度
      width: 32px;
      padding: 0;
      justify-content: center;
    }
  }

  // 徽章样式优化
  .account-badge {
    font-size: 11px;
    padding: 2px 8px;
    height: 20px;
    line-height: 16px;
    background-color: #f5f5f5;
    color: #666;
    font-weight: 500;
  }

  .status-badge {
    font-size: 11px;
    padding: 2px 8px;
    height: 20px;
    line-height: 16px;
    font-weight: 500;
  }
}

// 卡片悬停效果（更轻微）
:deep(.n-card.n-card--bordered) {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background-color: #fafafa;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
}

// 深色模式适配
html.dark {
  .slack-account-card {
    .clickable-area {
      &:hover {
        background-color: rgba(255, 255, 255, 0.06);
      }

      &:active {
        background-color: rgba(255, 255, 255, 0.12);
      }

      .nickname {
        color: #e0e0e0;
      }
    }

    .detail-row {
      color: #9e9e9e;

      .separator {
        color: #616161;
      }
    }

    .meta-row {
      color: #757575;

      .separator {
        color: #616161;
      }
    }

    .avatar-section .status-dot {
      border-color: #1e1e1e;
    }

    .actions-section {
      border-top-color: #333;
    }

    .account-badge {
      background-color: #2a2a2a;
      color: #999;
    }
  }

  :deep(.n-card.n-card--bordered) {
    &:hover {
      background-color: #2a2a2a;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
  }
}
</style>
