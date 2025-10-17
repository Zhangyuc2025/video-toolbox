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
import { PluginManagerService } from '@/services/plugin-manager';
import { autoFetchChannelsCookie } from '@/services/channels-cookie-fetcher';
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

// 自动发现未注册账号（只注册，不同步Cookie）
const autoDiscoverAccounts = async () => {
  try {
    // 注意：这里只是发现本地未注册的账号并注册到云端生成永久链接
    // 不进行Cookie同步，Cookie同步在打开浏览器时按需进行
    const result = await AccountSyncService.fullSync({ autoApplyUserFilter: true });

    if (result.localToCloud > 0) {
      // 重新加载账号信息
      await cookieStore.loadCookies();
    }

    return result;
  } catch (error) {
    console.error('[AccountList] 自动发现账号失败:', error);
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

// 打开浏览器（在线验证 + Cookie同步 + 启动）
const handleOpenBrowser = async (browserId: string) => {
  // 获取浏览器对象和账号信息
  const browser = browserStore.getBrowser(browserId);
  const cloudStatus = AccountMonitorService.getAccountStatus(browserId);
  const localAccount = browserStore.getAccountInfo(browserId);

  // 获取账号昵称和浏览器序号
  const accountName = cloudStatus?.accountInfo?.nickname || localAccount?.nickname || browser?.name || browserId;
  const browserSeq = browser?.seq || '?';

  const loadingMsg = message.loading(`正在打开 #${browserSeq} 账号 ${accountName}...`, { duration: 0 });

  try {
    // 🔥 关键步骤1：打开前先从云端同步Cookie到BitBrowser
    console.log(`[打开浏览器] 步骤1: 从云端同步Cookie到BitBrowser - ${browserId}`);

    let syncResult;
    try {
      syncResult = await AccountSyncService.syncSingle(browserId, true);

      if (!syncResult.success) {
        message.destroyAll();
        notification.error(`Cookie同步失败: ${syncResult.message}`, {
          title: '启动失败',
          duration: 5000
        });
        return;
      }

      // 如果云端Cookie掉线，不允许打开
      if (syncResult.action === 'skip' && cloudStatus?.cookieStatus === 'offline') {
        message.destroyAll();
        notification.error(`账号已掉线: ${accountName}，请重新登录`, {
          title: '启动失败',
          duration: 5000
        });
        return;
      }

      console.log(`[打开浏览器] 步骤2: Cookie同步成功，准备打开浏览器 - ${browserId}`);
    } catch (error) {
      message.destroyAll();
      console.error(`[打开浏览器] Cookie同步异常:`, error);
      notification.error(`Cookie同步异常，无法打开浏览器`, {
        title: '启动失败',
        duration: 5000
      });
      return;
    }

    // 🔥 步骤2.1：从同步结果中获取最新的登录方式（使用云端最新数据，避免缓存错误）
    const loginMethod = syncResult.accountInfo?.loginMethod || cloudStatus?.accountInfo?.loginMethod;

    if (!loginMethod) {
      message.destroyAll();
      notification.error('未找到该账号的登录信息，请确保账号已正确创建', {
        title: '启动失败',
        duration: 5000
      });
      return;
    }

    console.log(`[打开浏览器] 步骤2.1: 账号登录方式 = ${loginMethod}`);

    // 🔥 步骤2.2：使用云端智能验证（已自动处理 channels 和 shop helper 两种Cookie）
    console.log(`[打开浏览器] 步骤2.2: 调用云端智能验证 - ${browserId} (${loginMethod})`);

    try {
      const validationResult = await CloudService.instantValidateCookie(browserId);

      if (!validationResult) {
        message.destroyAll();
        notification.error(`Cookie验证失败：无法连接到验证服务`, {
          title: '启动失败',
          duration: 5000
        });
        return;
      }

      if (!validationResult.valid) {
        // Cookie已失效，拒绝打开
        message.destroyAll();
        notification.error(`Cookie已失效，无法打开浏览器`, {
          title: '启动失败',
          meta: `原因: ${validationResult.error || '未知'}`,
          duration: 5000
        });
        console.error(`[打开浏览器] Cookie验证失败，拒绝打开: ${browserId}`, validationResult.error);
        await AccountMonitorService.refreshAccountStatus(browserId);
        return;
      }

      // ✅ Cookie有效，允许打开
      console.log(`[打开浏览器] Cookie验证通过 - ${browserId}`);
      await AccountMonitorService.refreshAccountStatus(browserId);

      // ⚠️ 对于带货助手账号，检查是否需要重新获取视频号Cookie
      if (loginMethod === 'shop_helper' && validationResult.needRefetchChannelsCookie) {
        console.log(`[打开浏览器] ⚠️ 云端检测到需要重新获取视频号Cookie - ${browserId}`);
        notification.info(`带货助手Cookie正常，打开后将自动获取视频号Cookie`, {
          title: `#${browserSeq} ${accountName}`,
          duration: 3000
        });

        // 稍后自动获取视频号Cookie
        setTimeout(() => {
          autoFetchChannelsCookie({
            browserId,
            nickname: accountName,
            skipOpen: true
          });
        }, 2000);
      }
    } catch (error) {
      message.destroyAll();
      console.error(`[打开浏览器] Cookie验证异常:`, error);
      notification.error(`Cookie验证异常: ${error}`, {
        title: '启动失败',
        duration: 5000
      });
      return;
    }

    // 根据登录方式决定启动URL，并添加插件模式参数（使用Hash避免重定向丢失）
    // 同时传递 browser_id、owner 和 channels_jump_url 参数，供插件使用
    const owner = browserStore.currentUserName || '';
    let loadUrl: string | undefined;
    if (loginMethod === 'channels_helper') {
      // 视频号登录 → 打开视频号视频管理页面，插件会跳转到带货助手
      loadUrl = `https://channels.weixin.qq.com/platform/post/list#plugin_mode=channels&browser_id=${encodeURIComponent(browserId)}&owner=${encodeURIComponent(owner)}`;
    } else if (loginMethod === 'shop_helper') {
      // 带货助手登录 → 打开带货助手订单页面，插件会跳转到视频号
      // ✅ 直接从云端API获取最新的跳转链接（避免缓存不一致问题）
      let channelsJumpUrl = '';
      try {
        console.log(`[打开浏览器] 从云端获取跳转链接: ${browserId}`);
        const accountStatus = await CloudService.checkAccountStatus(browserId);
        channelsJumpUrl = accountStatus?.channelsJumpUrl || '';
        console.log(`[打开浏览器] 跳转链接获取结果: ${channelsJumpUrl ? '有缓存' : '无缓存（将调用API生成）'}`);
      } catch (error) {
        console.error(`[打开浏览器] 获取跳转链接失败:`, error);
      }

      const jumpUrlParam = channelsJumpUrl ? `&channels_jump_url=${encodeURIComponent(channelsJumpUrl)}` : '';
      loadUrl = `https://store.weixin.qq.com/talent/funds/order#plugin_mode=shop&browser_id=${encodeURIComponent(browserId)}&owner=${encodeURIComponent(owner)}${jumpUrlParam}`;
    }

    console.log(`[打开浏览器] 步骤3: 登录方式=${loginMethod}, 启动URL=${loadUrl}`);

    // 打开浏览器
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
        meta: `账号: ${accountName}`
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

// 检测Cookie有效性
const handleCheckCookie = async (browserId: string) => {
  // 获取账号信息
  const browser = browserStore.getBrowser(browserId);
  const cloudStatus = AccountMonitorService.getAccountStatus(browserId);
  const accountName = cloudStatus?.accountInfo?.nickname || browser?.name || browserId;
  const browserSeq = browser?.seq || '?';

  try {
    browserStore.setCookieChecking(browserId, true);
    message.info(`正在检测 #${browserSeq} 账号 ${accountName} 的Cookie有效性...`);

    // 调用云端即时验证接口
    const result = await CloudService.instantValidateCookie(browserId);

    if (!result) {
      notification.error('Cookie检测失败：无法连接到验证服务', {
        title: `检测失败 - #${browserSeq} ${accountName}`
      });
      return;
    }

    if (result.valid) {
      notification.success(`Cookie有效，账号在线`, {
        title: `检测成功 - #${browserSeq} ${accountName}`,
        meta: result.nickname || accountName
      });
    } else {
      notification.error(`Cookie已失效：${result.error || '未知原因'}`, {
        title: `检测失败 - #${browserSeq} ${accountName}`,
        duration: 8000
      });
    }

    // 刷新账号状态
    await AccountMonitorService.refreshAccountStatus(browserId);
  } catch (error) {
    console.error('检测Cookie失败:', error);
    notification.error(`检测异常: ${error}`, {
      title: `检测失败 - #${browserSeq} ${accountName}`
    });
  } finally {
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

    // ✅ 插件加载策略（无需后台同步）
    // 方案1：新浏览器创建时自动配置 extensions 字段（见 create_browser_with_account）
    // 方案2：所有浏览器打开时通过 --load-extension 参数动态加载（见 open_browser）
    // 结论：所有浏览器（包括已存在的）都会在打开时自动加载插件，无需后台同步配置

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
