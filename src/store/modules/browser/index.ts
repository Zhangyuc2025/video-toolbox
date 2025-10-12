import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { configStore } from '@/utils/config-store';
import type {
  Browser,
  BrowserGroup,
  CookieStatus,
  AccountInfo,
  BrowserListResponse,
  LaunchOptions,
  ApiResponse
} from '@/types/browser';

export const useBrowserStore = defineStore('browser', () => {
  // ==================== 状态 ====================

  /** 浏览器列表 */
  const browsers = ref<Browser[]>([]);

  /** 运行中的浏览器ID集合 */
  const runningBrowsers = ref<Set<string>>(new Set());

  /** 账号信息映射 */
  const accountInfo = ref<Map<string, AccountInfo>>(new Map());

  /** 分组列表 */
  const groups = ref<BrowserGroup[]>([{ id: 'all', name: '全部', count: 0 }]);

  /** 当前选中的分组 */
  const currentGroupFilter = ref<string>('all');

  /** 当前选中的登录状态筛选 */
  const currentLoginStatusFilter = ref<string>('all');

  /** 当前用户名（用于筛选） - 从 configStore 异步加载 */
  const currentUserName = ref<string>('');

  /** 是否只显示我的浏览器 - 从 configStore 异步加载，默认开启 */
  const filterMyAccounts = ref<boolean>(true);

  /** 配置是否已加载完成 */
  const isConfigLoaded = ref<boolean>(false);

  // 初始化时从 configStore 加载配置
  const configLoadPromise = (async () => {
    try {
      currentUserName.value = await configStore.getUsername();
      filterMyAccounts.value = await configStore.getFilterMyAccounts();
      console.log('[BrowserStore] 配置加载完成 - currentUserName:', currentUserName.value, 'filterMyAccounts:', filterMyAccounts.value);
    } catch (error) {
      console.error('[BrowserStore] 配置加载失败:', error);
    } finally {
      isConfigLoaded.value = true;
    }
  })();

  /**
   * 等待配置加载完成
   */
  async function waitForConfigLoad() {
    await configLoadPromise;
  }

  /** 是否正在加载 */
  const isLoading = ref<boolean>(false);

  /** 加载提示消息 */
  const loadingMessage = ref<string>('');

  /** 正在检测Cookie的浏览器ID集合 */
  const checkingCookies = ref<Set<string>>(new Set());

  // ==================== 计算属性 ====================

  /** 浏览器ID到浏览器对象的映射（快速查找） */
  const browserMap = computed(() => {
    return new Map(browsers.value.map(b => [b.id, b]));
  });

  /** 过滤后的浏览器列表（根据分组筛选，用户筛选在后端已完成） */
  const filteredBrowsers = computed(() => {
    let filtered = browsers.value;

    // 按分组筛选
    if (currentGroupFilter.value !== 'all') {
      filtered = filtered.filter(b => b.groupId === currentGroupFilter.value);
    }

    return filtered;
  });

  /** 运行中的浏览器数量 */
  const runningCount = computed(() => {
    return runningBrowsers.value.size;
  });

  /** 总浏览器数量 */
  const totalCount = computed(() => {
    return browsers.value.length;
  });

  // ==================== Actions ====================

  /**
   * 设置浏览器列表
   */
  function setBrowsers(browserList: Browser[]) {
    browsers.value = browserList;
    updateGroupCounts();
  }

  /**
   * 更新分组计数
   */
  function updateGroupCounts() {
    const groupMap = new Map<string, { id: string; name: string; count: number }>();

    // 从浏览器列表中提取所有分组
    browsers.value.forEach(browser => {
      if (browser.groupId && browser.groupName) {
        const existing = groupMap.get(browser.groupId);
        if (existing) {
          existing.count++;
        } else {
          groupMap.set(browser.groupId, {
            id: browser.groupId,
            name: browser.groupName,
            count: 1
          });
        }
      }
    });

    // 重新构建分组列表
    const newGroups: BrowserGroup[] = [
      { id: 'all', name: '全部', count: browsers.value.length }
    ];

    // 添加提取出的分组，按名称排序
    const extractedGroups = Array.from(groupMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    newGroups.push(...extractedGroups);

    groups.value = newGroups;
  }

  /**
   * 设置运行中的浏览器
   */
  function setRunningBrowsers(browserIds: string[]) {
    runningBrowsers.value = new Set(browserIds);
  }

  /**
   * 更新单个浏览器的运行状态
   */
  function updateBrowserRunningStatus(browserId: string, isRunning: boolean) {
    if (isRunning) {
      runningBrowsers.value.add(browserId);
    } else {
      runningBrowsers.value.delete(browserId);
    }
  }

  /**
   * 检查浏览器是否正在运行
   */
  function isBrowserRunning(browserId: string): boolean {
    return runningBrowsers.value.has(browserId);
  }

  /**
   * 设置Cookie检测状态
   */
  function setCookieChecking(browserId: string, isChecking: boolean) {
    if (isChecking) {
      checkingCookies.value.add(browserId);
    } else {
      checkingCookies.value.delete(browserId);
    }
  }

  /**
   * 检查Cookie是否正在检测中
   */
  function isCookieChecking(browserId: string): boolean {
    return checkingCookies.value.has(browserId);
  }

  /**
   * 更新账号信息
   */
  function updateAccountInfo(browserId: string, info: AccountInfo) {
    accountInfo.value.set(browserId, info);
  }

  /**
   * 获取账号信息
   */
  function getAccountInfo(browserId: string): AccountInfo | undefined {
    return accountInfo.value.get(browserId);
  }

  /**
   * 添加浏览器
   */
  function addBrowser(browser: Browser) {
    browsers.value.push(browser);
    updateGroupCounts();
  }

  /**
   * 更新浏览器
   */
  function updateBrowser(browserId: string, updates: Partial<Browser>) {
    const index = browsers.value.findIndex(b => b.id === browserId);
    if (index !== -1) {
      browsers.value[index] = { ...browsers.value[index], ...updates };
    }
  }

  /**
   * 删除浏览器
   */
  function removeBrowser(browserId: string) {
    const index = browsers.value.findIndex(b => b.id === browserId);
    if (index !== -1) {
      browsers.value.splice(index, 1);
      runningBrowsers.value.delete(browserId);
      accountInfo.value.delete(browserId);
      checkingCookies.value.delete(browserId);
      updateGroupCounts();
    }
  }

  /**
   * 设置分组筛选
   */
  function setGroupFilter(groupId: string) {
    currentGroupFilter.value = groupId;
  }

  /**
   * 设置登录状态筛选
   */
  function setLoginStatusFilter(status: string) {
    currentLoginStatusFilter.value = status;
  }

  /**
   * 设置当前用户名
   */
  async function setCurrentUserName(userName: string) {
    currentUserName.value = userName;
    await configStore.setUsername(userName);
  }

  /**
   * 设置是否只显示我的浏览器
   */
  async function setFilterMyAccounts(filter: boolean) {
    filterMyAccounts.value = filter;
    await configStore.setFilterMyAccounts(filter);
  }

  /**
   * 设置加载状态
   */
  function setLoading(loading: boolean, message = '') {
    isLoading.value = loading;
    loadingMessage.value = message;
  }

  /**
   * 清空所有数据
   */
  function clearAll() {
    browsers.value = [];
    runningBrowsers.value.clear();
    accountInfo.value.clear();
    checkingCookies.value.clear();
    currentGroupFilter.value = 'all';
    updateGroupCounts();
  }

  /**
   * 获取浏览器对象
   */
  function getBrowser(browserId: string): Browser | undefined {
    return browserMap.value.get(browserId);
  }

  return {
    // 状态
    browsers,
    runningBrowsers,
    accountInfo,
    groups,
    currentGroupFilter,
    currentLoginStatusFilter,
    currentUserName,
    filterMyAccounts,
    isConfigLoaded,
    isLoading,
    loadingMessage,
    checkingCookies,

    // 计算属性
    browserMap,
    filteredBrowsers,
    runningCount,
    totalCount,

    // Actions
    setBrowsers,
    setRunningBrowsers,
    updateBrowserRunningStatus,
    isBrowserRunning,
    setCookieChecking,
    isCookieChecking,
    updateAccountInfo,
    getAccountInfo,
    addBrowser,
    updateBrowser,
    removeBrowser,
    setGroupFilter,
    setLoginStatusFilter,
    setCurrentUserName,
    setFilterMyAccounts,
    setLoading,
    clearAll,
    getBrowser,
    updateGroupCounts,
    waitForConfigLoad
  };
});
