<script setup lang="ts">
import { computed, ref } from 'vue';
import { NDrawer, NDrawerContent, NDescriptions, NDescriptionsItem, NTag, NAvatar, NSpace, NButton, NIcon, NSpin, NEmpty } from 'naive-ui';
import type { Browser } from '@/types/browser';
import { useBrowserStore } from '@/store/modules/browser';
import { AccountMonitorService } from '@/services/account-monitor';
import { formatDateTime } from '@/utils/format';

interface Props {
  show: boolean;
  browser: Browser;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:show': [value: boolean];
}>();

const browserStore = useBrowserStore();

// 本地显示状态
const localShow = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
});

// 获取云端Cookie状态
const cloudCookieStatus = computed(() => {
  return AccountMonitorService.getAccountStatus(props.browser.id);
});

// 计算账号信息（只从云端 Realtime 数据获取）
const accountInfo = computed(() => {
  const cloudStatus = cloudCookieStatus.value;
  if (cloudStatus?.accountInfo) {
    return {
      nickname: cloudStatus.accountInfo.nickname,
      avatar: cloudStatus.accountInfo.avatar || '',
      loginMethod: cloudStatus.accountInfo.loginMethod
    };
  }

  return null;
});

// Cookie状态文本和颜色
const cookieStatusInfo = computed(() => {
  const cloudStatus = cloudCookieStatus.value;

  if (!cloudStatus || !cloudStatus.cookieStatus) {
    return { text: '未登录', type: 'warning' as const };
  }

  switch (cloudStatus.cookieStatus) {
    case 'online':
      return { text: '在线', type: 'success' as const };
    case 'offline':
      return { text: '掉线', type: 'error' as const };
    case 'checking':
      return { text: '检测中', type: 'info' as const };
    case 'pending':
      return { text: '未登录', type: 'warning' as const };
  }
});

// 运行状态
const isRunning = computed(() => browserStore.isBrowserRunning(props.browser.id));

// 登录方式文本
const loginMethodText = computed(() => {
  if (!accountInfo.value?.loginMethod) return '未知';
  return accountInfo.value.loginMethod === 'channels_helper'
    ? '视频号助手'
    : '小店带货助手';
});

// 代理类型文本
const proxyTypeText = computed(() => {
  const { proxyType } = props.browser;
  if (!proxyType || proxyType === 'noproxy') return '无代理';
  return proxyType.toUpperCase();
});

// 在线时长
const onlineTime = computed(() => {
  const cloudStatus = cloudCookieStatus.value;
  const localAccount = browserStore.getAccountInfo(props.browser.id);

  if (!cloudStatus || cloudStatus.cookieStatus === 'pending' || cloudStatus.cookieStatus === 'checking') {
    return null;
  }

  const loginTime = localAccount?.loginTime;
  if (!loginTime) return null;

  let endTime: number;
  let prefix: string;

  if (cloudStatus.cookieStatus === 'online') {
    endTime = Date.now();
    prefix = '本次';
  } else if (cloudStatus.cookieStatus === 'offline' && cloudStatus.cookieExpiredAt) {
    endTime = new Date(cloudStatus.cookieExpiredAt).getTime();
    prefix = '上次';
  } else {
    return null;
  }

  const hours = ((endTime - loginTime) / (1000 * 60 * 60)).toFixed(1);
  return `${prefix} ${hours} 小时`;
});

// 格式化时间
const formatTime = (time: string | number | null | undefined) => {
  if (!time) return '-';
  return formatDateTime(new Date(time));
};
</script>

<template>
  <NDrawer
    v-model:show="localShow"
    :width="480"
    placement="right"
  >
    <NDrawerContent
      title="账号详情"
      closable
    >
      <div class="account-detail">
        <!-- 详细信息 -->
        <NDescriptions
          bordered
          :column="1"
          label-placement="left"
          label-style="width: 120px; font-weight: 500;"
        >
          <!-- 基本信息 -->
          <NDescriptionsItem label="浏览器ID">
            {{ browser.id }}
          </NDescriptionsItem>

          <NDescriptionsItem label="登录方式">
            {{ loginMethodText }}
          </NDescriptionsItem>

          <NDescriptionsItem label="在线状态">
            <NTag
              :type="cookieStatusInfo.type"
              size="small"
              :bordered="false"
            >
              {{ cookieStatusInfo.text }}
            </NTag>
          </NDescriptionsItem>

          <NDescriptionsItem v-if="onlineTime" label="在线时长">
            {{ onlineTime }}
          </NDescriptionsItem>

          <NDescriptionsItem v-if="browser.remark" label="备注">
            {{ browser.remark }}
          </NDescriptionsItem>

          <NDescriptionsItem v-if="browser.groupName" label="分组">
            {{ browser.groupName }}
          </NDescriptionsItem>

          <!-- 代理信息 -->
          <NDescriptionsItem label="代理类型">
            {{ proxyTypeText }}
          </NDescriptionsItem>

          <NDescriptionsItem v-if="browser.host && browser.port" label="代理地址">
            {{ browser.host }}:{{ browser.port }}
          </NDescriptionsItem>

          <NDescriptionsItem v-if="browser.proxyUserName" label="代理用户名">
            {{ browser.proxyUserName }}
          </NDescriptionsItem>

          <!-- Cookie 状态信息 -->
          <template v-if="cloudCookieStatus">
            <NDescriptionsItem label="最后检测时间">
              {{ formatTime(cloudCookieStatus.lastCheckTime) }}
            </NDescriptionsItem>

            <NDescriptionsItem v-if="cloudCookieStatus.lastValidTime" label="最后在线时间">
              {{ formatTime(cloudCookieStatus.lastValidTime) }}
            </NDescriptionsItem>

            <NDescriptionsItem v-if="cloudCookieStatus.cookieUpdatedAt" label="账号登录时间">
              {{ formatTime(cloudCookieStatus.cookieUpdatedAt) }}
            </NDescriptionsItem>

            <NDescriptionsItem v-if="cloudCookieStatus.cookieExpiredAt" label="掉线时间">
              {{ formatTime(cloudCookieStatus.cookieExpiredAt) }}
            </NDescriptionsItem>
          </template>

          <!-- 本地账号信息 -->
          <template v-if="browserStore.getAccountInfo(browser.id)">
            <NDescriptionsItem label="登录时间">
              {{ formatTime(browserStore.getAccountInfo(browser.id)?.loginTime) }}
            </NDescriptionsItem>

            <NDescriptionsItem label="更新时间">
              {{ formatTime(browserStore.getAccountInfo(browser.id)?.updatedAt) }}
            </NDescriptionsItem>
          </template>
        </NDescriptions>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped lang="scss">
.account-detail {
  // 无需额外样式，直接展示描述列表
}
</style>
