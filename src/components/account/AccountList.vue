<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { invoke } from '@tauri-apps/api/tauri';
import { useRouter } from 'vue-router';
import { NSpace, NButton, NInput, NSelect, NCheckbox, NEmpty, NSpin, NAlert, NCard } from 'naive-ui';
import AccountCard from './AccountCard.vue';
import AddAccountDrawer from './AddAccountDrawer.vue';
import { useBrowserStore } from '@/store/modules/browser';
import { useCookieStore } from '@/stores/cookie';
import { notification, dialog, message } from '@/utils';
import { CloudService } from '@/services/cloud';
import { AccountMonitorService, accountMonitorState } from '@/services/account-monitor';
import { AccountSyncService } from '@/services/account-sync';
import { realtimePushService } from '@/services/realtime-push';
import type { ApiResponse, BrowserListResponse } from '@/types/browser';

const router = useRouter();
const browserStore = useBrowserStore();
const cookieStore = useCookieStore();

// 添加账号 Drawer
const showAddAccountDrawer = ref(false);

// 检查状态
const isBitBrowserRunning = ref(false);
const isCheckingPrerequisites = ref(true);

// 搜索关键词
const searchKeyword = ref('');

// 基于浏览器列表计算分组（后端已完成用户筛选）
const filteredGroups = computed(() => {
  // 直接使用 browserStore.groups，它已经基于当前 browsers 计算好了
  return browserStore.groups;
});

// 分组选项
const groupOptions = computed(() => {
  return filteredGroups.value.map(g => ({
    label: `${g.name} (${g.count})`,
    value: g.id
  }));
});

// 检查是否满足使用条件
const canUse = computed(() => {
  // BitBrowser 必须运行
  if (!isBitBrowserRunning.value) {
    return false;
  }

  // 如果开启了"只看我的账号"，则必须设置用户名
  if (browserStore.filterMyAccounts && !browserStore.currentUserName) {
    return false;
  }

  return true;
});

// 检查缺少的条件
const missingConditions = computed(() => {
  const conditions = [];
  if (!isBitBrowserRunning.value) {
    conditions.push('BitBrowser 未运行');
  }
  if (browserStore.filterMyAccounts && !browserStore.currentUserName) {
    conditions.push('未设置用户名');
  }
  return conditions;
});

// 过滤后的浏览器列表（根据搜索关键词和登录状态）
const displayBrowsers = computed(() => {
  let filtered = browserStore.filteredBrowsers;

  // 按登录状态筛选
  if (browserStore.currentLoginStatusFilter !== 'all') {
    const cloudCache = accountMonitorState.cloudStatusCache.value;
    filtered = filtered.filter(browser => {
      const cloudStatus = cloudCache[browser.id];
      if (!cloudStatus) {
        return browserStore.currentLoginStatusFilter === 'pending';
      }
      return cloudStatus.cookieStatus === browserStore.currentLoginStatusFilter;
    });
  }

  // 按搜索关键词筛选
  if (!searchKeyword.value.trim()) {
    return filtered;
  }

  const keyword = searchKeyword.value.toLowerCase();
  return filtered.filter(browser =>
    browser.name.toLowerCase().includes(keyword) ||
    browser.id.toLowerCase().includes(keyword) ||
    browser.remark?.toLowerCase().includes(keyword) ||
    browser.groupName?.toLowerCase().includes(keyword)
  );
});


// 检查前置条件
const checkPrerequisites = async () => {
  try {
    isCheckingPrerequisites.value = true;

    // 检查 BitBrowser 是否运行
    try {
      const response = await invoke<ApiResponse>('check_bitbrowser_running');
      isBitBrowserRunning.value = response.success;
    } catch (error) {
      console.error('[AccountList] 检查 BitBrowser 运行状态失败:', error);
      isBitBrowserRunning.value = false;
    }
  } finally {
    isCheckingPrerequisites.value = false;
  }
};

// 自动发现未注册账号（使用统一的账号同步服务）
const autoDiscoverAccounts = async () => {
  try {
    // 自动应用用户筛选配置
    const result = await AccountSyncService.fullSync({ autoApplyUserFilter: true });

    if (result.localToCloud > 0) {
      // 重新加载账号信息
      await cookieStore.loadCookies();
    }

    return result;
  } catch (error) {
    console.error('[AccountList] 自动同步失败:', error);
  }
};

// 加载浏览器列表
const loadBrowserList = async (autoDiscover = true) => {
  // 检查前置条件
  if (!canUse.value) {
    notification.warning('请先启动 BitBrowser 并设置用户名');
    return;
  }

  try {
    browserStore.setLoading(true, '正在加载浏览器列表...');

    // 构建请求参数：如果启用了筛选且设置了用户名，传入 createdName
    const params: any = {
      page: 0,
      pageSize: 100
    };

    if (browserStore.filterMyAccounts && browserStore.currentUserName) {
      params.createdName = browserStore.currentUserName;
    }

    const response = await invoke<ApiResponse<BrowserListResponse>>('get_browser_list', params);

    if (response.success && response.data) {
      browserStore.setBrowsers(response.data.list);
      notification.success(`成功加载 ${response.data.list.length} 个浏览器`);

      // 后台任务（不阻塞主流程）
      if (autoDiscover) {
        setTimeout(async () => {
          // 1. 自动发现未注册账号
          await autoDiscoverAccounts();

          // 2. 批量对比并同步浏览器名称（确保与云端一致）
          const browserIds = response.data.list.map((b: any) => b.id);
          if (browserIds.length > 0) {
            await AccountSyncService.syncBrowserNamesFromCloud(browserIds);
          }
        }, 500);
      }
    } else {
      notification.error(response.message || '加载浏览器列表失败');
    }
  } catch (error) {
    console.error('加载浏览器列表失败:', error);
    notification.error(`加载失败: ${error}`);
  } finally {
    browserStore.setLoading(false);
  }
};

// 打开浏览器（优化版：使用本地缓存 + 后台验证）
const handleOpenBrowser = async (browserId: string) => {
  // ✅ 获取浏览器对象和账号信息（用于显示友好的提示）
  const browser = browserStore.getBrowser(browserId);
  const cloudStatus = AccountMonitorService.getAccountStatus(browserId);
  const localAccount = browserStore.getAccountInfo(browserId);

  // 获取账号昵称和浏览器序号
  const accountName = cloudStatus?.accountInfo?.nickname || localAccount?.nickname || browser?.name || browserId;
  const browserSeq = browser?.seq || '?';

  const loadingMsg = message.loading(`正在打开 #${browserSeq} 账号 ${accountName}...`, { duration: 0 });

  try {

    let loadUrl: string | undefined;

    // 检查本地缓存的登录方式
    const loginMethod = cloudStatus?.accountInfo?.loginMethod || localAccount?.loginMethod;

    if (!loginMethod) {
      // 未找到账号信息，禁止启动
      message.destroyAll();
      notification.error('未找到该账号的登录信息，请确保账号已正确创建', {
        title: '启动失败',
        duration: 5000
      });
      return;
    }

    // 根据登录方式决定启动URL
    if (loginMethod === 'channels_helper') {
      // 视频号助手
      loadUrl = 'https://channels.weixin.qq.com/platform';
    } else if (loginMethod === 'shop_helper') {
      // 小店带货助手
      loadUrl = 'https://store.weixin.qq.com/talent';
    }

    // ✅ 优化2：使用本地缓存检查Cookie状态（瞬间完成）
    if (cloudStatus?.cookieStatus === 'offline') {
      // 账号已掉线（根据缓存状态）
      message.destroyAll();
      notification.error(`账号已掉线: ${accountName}，请重新登录`, {
        title: '启动失败',
        duration: 5000
      });
      return;
    }

    // 立即打开浏览器（不等待云端验证）
    const response = await invoke<ApiResponse>('open_browser', {
      browserId,
      args: [],
      loadUrl,
      clearCookies: false
    });

    message.destroyAll();

    if (response.success) {
      browserStore.updateBrowserRunningStatus(browserId, true);
      notification.success(`浏览器 #${browserSeq} 已成功打开`, {
        meta: `账号: ${accountName} | Cookie失效会自动关闭`
      });

      // ✅ 优化3：打开成功后，后台验证Cookie状态（不阻塞用户）
      CloudService.instantValidateCookie(browserId).then(validation => {
        if (!validation) {
          console.warn(`[后台验证] Cookie验证失败: ${browserId}`);
          return;
        }

        if (!validation.valid) {
          // Cookie实际已失效，但缓存未更新，立即通知用户
          console.warn(`[后台验证] 检测到Cookie失效: ${browserId}`);
          notification.warning(`账号 ${validation.nickname || browserId} 的Cookie已失效，请重新登录`, {
            title: '账号状态变化',
            duration: 8000
          });

          // 立即更新本地缓存状态，防止按钮继续可用
          // 这会触发 Realtime 推送或直接更新缓存
          AccountMonitorService.refreshAccountStatus(browserId);
        } else {
          console.log(`[后台验证] Cookie有效: ${browserId}`);
        }
      }).catch(error => {
        console.error(`[后台验证] 验证出错: ${browserId}`, error);
      });
    } else {
      notification.error(response.message || '打开浏览器失败');
    }
  } catch (error) {
    message.destroyAll();
    console.error('打开浏览器失败:', error);
    notification.error(`打开失败: ${error}`);
  }
};

// 关闭浏览器
const handleCloseBrowser = async (browserId: string) => {
  // 获取浏览器对象和账号信息
  const browser = browserStore.getBrowser(browserId);
  const cloudStatus = AccountMonitorService.getAccountStatus(browserId);
  const localAccount = browserStore.getAccountInfo(browserId);

  const accountName = cloudStatus?.accountInfo?.nickname || localAccount?.nickname || browser?.name || browserId;
  const browserSeq = browser?.seq || '?';

  const loadingMsg = message.loading(`正在关闭 #${browserSeq} 账号 ${accountName}...`, { duration: 0 });

  try {
    const response = await invoke<ApiResponse>('close_browser', {
      browserId
    });

    message.destroyAll();

    if (response.success) {
      browserStore.updateBrowserRunningStatus(browserId, false);
      notification.success(`浏览器 #${browserSeq} 已成功关闭`);
    } else {
      notification.error(response.message || '关闭浏览器失败');
    }
  } catch (error) {
    message.destroyAll();
    console.error('关闭浏览器失败:', error);
    notification.error(`关闭失败: ${error}`);
  }
};

// 删除浏览器
const handleDeleteBrowser = async (browserId: string) => {
  const browser = browserStore.getBrowser(browserId);
  if (!browser) return;

  dialog.confirm({
    title: '确认删除',
    content: `确定要删除浏览器 "${browser.name}" 吗？此操作不可恢复。`,
    positiveText: '确定删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const browserSeq = browser.seq || '?';
      const loadingMsg = message.loading(`正在删除 #${browserSeq} ${browser.name}...`, { duration: 0 });

      try {
        const response = await invoke<ApiResponse>('delete_browser', {
          browserId
        });

        message.destroyAll();

        if (response.success) {
          // 删除浏览器状态
          browserStore.removeBrowser(browserId);

          // 同时删除本地存储的账号信息和云端链接
          try {
            // 取消 Realtime 订阅（清理资源）
            realtimePushService.unsubscribe(browserId);

            // 删除云端链接（不依赖本地 linkToken）
            CloudService.deletePermanentLinkByBrowser(browserId).catch(error => {
              console.error('[删除账号] 删除云端链接异常:', error);
            });

            // 删除本地账号数据
            await cookieStore.deleteCookie(browserId);
          } catch (error) {
            console.error('删除本地账号数据失败:', error);
          }

          notification.success('浏览器已成功删除');
        } else {
          notification.error(response.message || '删除浏览器失败');
        }
      } catch (error) {
        message.destroyAll();
        console.error('删除浏览器失败:', error);
        notification.error(`删除失败: ${error}`);
      }
    }
  });
};

// 检测Cookie
const handleCheckCookie = async (browserId: string) => {
  try {
    browserStore.setCookieChecking(browserId, true);
    notification.info('Cookie检测功能待实现...');

    // TODO: 实现Cookie检测逻辑
    // 这里需要调用视频号API检测Cookie有效性

    // 模拟检测延迟
    setTimeout(() => {
      browserStore.setCookieChecking(browserId, false);
    }, 2000);
  } catch (error) {
    console.error('检测Cookie失败:', error);
    notification.error(`检测失败: ${error}`);
    browserStore.setCookieChecking(browserId, false);
  }
};

// 跳转到设置页面
const goToSettings = () => {
  router.push('/settings');
};

// 重新检查条件
const recheckConditions = async () => {
  await checkPrerequisites();
  if (canUse.value) {
    await loadBrowserList();
  }
};

// 组件挂载时先检查前置条件
onMounted(async () => {
  // 等待 browserStore 完成异步配置加载
  await browserStore.waitForConfigLoad();

  await checkPrerequisites();

  if (canUse.value) {
    // 加载账号监控服务缓存（自动清理无效缓存）
    await AccountMonitorService.loadCacheFromStorage();

    // 启动账号监控服务（Realtime 推送 + 云端状态同步）
    await AccountMonitorService.start();

    // 加载账号信息（Cookie Store）
    await cookieStore.loadCookies();

    // 加载浏览器列表（会在后台触发 autoDiscoverAccounts）
    await loadBrowserList();
  }
});

// 组件卸载时停止账号监控服务
onBeforeUnmount(() => {
  AccountMonitorService.stop();
});
</script>

<template>
  <div class="account-list-container">
    <!-- 检查前置条件中 -->
    <div v-if="isCheckingPrerequisites" class="checking-container">
      <NSpin size="large" description="正在检查前置条件..." />
    </div>

    <!-- 前置条件不满足 -->
    <div v-else-if="!canUse" class="blocked-container">
      <div class="blocked-content">
        <div class="blocked-icon">
          <icon-mdi:alert-circle-outline />
        </div>

        <h2 class="blocked-title">账号管理功能暂不可用</h2>

        <p class="blocked-desc">检测到以下条件未满足，请按照下方提示处理后重试</p>

        <div class="condition-list">
          <div v-if="!isBitBrowserRunning" class="condition-item">
            <div class="condition-icon error">
              <icon-mdi:close-circle />
            </div>
            <div class="condition-content">
              <h3>BitBrowser 未运行</h3>
              <p>请手动启动 BitBrowser 应用程序</p>
            </div>
          </div>

          <div v-if="browserStore.filterMyAccounts && !browserStore.currentUserName" class="condition-item">
            <div class="condition-icon error">
              <icon-mdi:close-circle />
            </div>
            <div class="condition-content">
              <h3>用户名未设置</h3>
              <p>已开启"只看我的账号"，需要在设置中配置 BitBrowser 用户名</p>
            </div>
          </div>
        </div>

        <div class="action-buttons">
          <NButton
            v-if="browserStore.filterMyAccounts && !browserStore.currentUserName"
            type="primary"
            size="large"
            @click="goToSettings"
          >
            <template #icon>
              <icon-mdi:cog />
            </template>
            前往设置
          </NButton>

          <NButton
            size="large"
            @click="recheckConditions"
          >
            <template #icon>
              <icon-mdi:refresh />
            </template>
            重新检查
          </NButton>
        </div>
      </div>
    </div>

    <!-- 正常内容区域 -->
    <template v-else>
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <!-- 登录状态 Tab -->
          <div class="status-tabs">
            <button
              class="status-tab"
              :class="{ active: browserStore.currentLoginStatusFilter === 'all' }"
              @click="browserStore.currentLoginStatusFilter = 'all'"
            >
              全部
            </button>
            <button
              class="status-tab"
              :class="{ active: browserStore.currentLoginStatusFilter === 'online' }"
              @click="browserStore.currentLoginStatusFilter = 'online'"
            >
              在线
            </button>
            <button
              class="status-tab"
              :class="{ active: browserStore.currentLoginStatusFilter === 'offline' }"
              @click="browserStore.currentLoginStatusFilter = 'offline'"
            >
              掉线
            </button>
            <button
              class="status-tab"
              :class="{ active: browserStore.currentLoginStatusFilter === 'pending' }"
              @click="browserStore.currentLoginStatusFilter = 'pending'"
            >
              未登录
            </button>
          </div>

          <!-- 分组筛选 -->
          <NSelect
            v-model:value="browserStore.currentGroupFilter"
            :options="groupOptions"
            style="width: 160px"
          />

          <!-- 搜索框 -->
          <NInput
            v-model:value="searchKeyword"
            placeholder="搜索账号"
            clearable
            style="width: 200px"
          >
            <template #prefix>
              <icon-mdi:magnify />
            </template>
          </NInput>
        </div>

        <!-- 操作按钮 -->
        <div class="toolbar-right">
          <NButton type="primary" @click="showAddAccountDrawer = true">
            <template #icon>
              <icon-mdi:plus />
            </template>
            添加账号
          </NButton>

          <NButton @click="loadBrowserList">
            <template #icon>
              <icon-mdi:refresh />
            </template>
          </NButton>
        </div>
      </div>

      <!-- 加载状态 -->
      <NSpin v-if="browserStore.isLoading" :description="browserStore.loadingMessage" size="large">
        <div class="loading-placeholder" />
      </NSpin>

      <!-- 浏览器列表 -->
      <div v-else-if="displayBrowsers.length > 0" class="browser-grid">
        <AccountCard
          v-for="browser in displayBrowsers"
          :key="browser.id"
          :browser="browser"
          @open="handleOpenBrowser"
          @close="handleCloseBrowser"
          @delete="handleDeleteBrowser"
          @check-cookie="handleCheckCookie"
        />
      </div>

      <!-- 空状态 -->
      <NEmpty
        v-else
        description="暂无浏览器数据"
        style="margin-top: 60px"
      >
        <template #extra>
          <NButton type="primary" @click="loadBrowserList">
            刷新列表
          </NButton>
        </template>
      </NEmpty>
    </template>

    <!-- 添加账号 Drawer -->
    <AddAccountDrawer
      v-model:show="showAddAccountDrawer"
      @success="loadBrowserList"
    />
  </div>
</template>

<style scoped lang="scss">
.account-list-container {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.checking-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.blocked-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  padding: 40px 20px;

  .blocked-content {
    max-width: 600px;
    width: 100%;
    text-align: center;
  }

  .blocked-icon {
    font-size: 80px;
    color: #faad14;
    margin-bottom: 24px;
    animation: pulse 2s ease-in-out infinite;
  }

  .blocked-title {
    font-size: 24px;
    font-weight: 600;
    color: #333;
    margin: 0 0 12px 0;
  }

  .blocked-desc {
    font-size: 14px;
    color: #666;
    margin: 0 0 32px 0;
  }

  .condition-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 32px;
    text-align: left;
  }

  .condition-item {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 20px;
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 12px;
    transition: all 0.3s ease;

    &:hover {
      border-color: #d9d9d9;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
  }

  .condition-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;

    &.error {
      background: #fff2e8;
      color: #ff4d4f;
    }

    &.success {
      background: #f6ffed;
      color: #52c41a;
    }
  }

  .condition-content {
    flex: 1;

    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin: 0 0 4px 0;
    }

    p {
      font-size: 14px;
      color: #666;
      margin: 0;
      line-height: 1.6;
    }
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.8;
    }
  }
}

.toolbar {
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-tabs {
    display: flex;
    background: #f5f5f5;
    border-radius: 6px;
    padding: 3px;
    gap: 2px;

    .status-tab {
      padding: 6px 16px;
      border: none;
      background: transparent;
      color: #666;
      font-size: 14px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover {
        background: rgba(24, 160, 88, 0.08);
        color: #18a058;
      }

      &.active {
        background: white;
        color: #18a058;
        font-weight: 500;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    }
  }
}

.loading-placeholder {
  min-height: 400px;
}

.browser-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  flex: 1;
  align-content: start;
  overflow-y: auto;
  padding-bottom: 16px;

  /* 滚动条美化 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;

    &:hover {
      background: #555;
    }
  }
}

/* 响应式布局 */
@media (max-width: 1440px) {
  .browser-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

@media (max-width: 1024px) {
  .browser-grid {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
}

@media (max-width: 768px) {
  .browser-grid {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch !important;
    gap: 12px;

    .toolbar-left {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;

      .status-tabs {
        width: 100%;
        justify-content: space-between;

        .status-tab {
          flex: 1;
          padding: 8px 12px;
        }
      }

      .n-select,
      .n-input {
        width: 100% !important;
      }
    }

    .toolbar-right {
      width: 100%;
      gap: 8px;

      .n-button {
        flex: 1;
      }
    }
  }
}

/* 深色模式适配 */
html.dark {
  .toolbar {
    background: #18181c;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);

    .status-tabs {
      background: #2c2c2c;

      .status-tab {
        color: #aaa;

        &:hover {
          background: rgba(24, 160, 88, 0.15);
          color: #18a058;
        }

        &.active {
          background: #18181c;
          color: #18a058;
        }
      }
    }
  }

  .browser-grid {
    &::-webkit-scrollbar-track {
      background: #2c2c2c;
    }

    &::-webkit-scrollbar-thumb {
      background: #555;

      &:hover {
        background: #777;
      }
    }
  }

  .blocked-container {
    .blocked-title {
      color: #ddd;
    }

    .blocked-desc {
      color: #aaa;
    }

    .condition-item {
      background: #18181c;
      border-color: #333;

      &:hover {
        border-color: #555;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      }
    }

    .condition-content {
      h3 {
        color: #ddd;
      }

      p {
        color: #aaa;
      }
    }
  }
}
</style>
