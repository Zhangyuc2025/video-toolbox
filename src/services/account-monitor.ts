/**
 * 账号状态监控服务
 *
 * 架构说明：
 * - 云端定时任务(GitHub Actions)每55分钟主动检测所有账号Cookie状态
 * - 检测结果直接更新数据库的 cookie_status 字段
 * - 应用端通过Supabase Realtime实时订阅数据库变化（完全基于推送，无轮询）
 * - 收到推送后立即更新本地缓存并发送桌面通知
 *
 * 功能：
 * 1. 启动时同步一次初始状态
 * 2. 订阅Realtime实时推送（完全无需轮询）
 * 3. 缓存状态到本地，提供快速查询
 * 4. Cookie失效时立即发送桌面通知
 *
 * 注意：
 * - 需要正确配置Supabase才能接收实时通知
 * - Realtime不可用时将无法接收Cookie失效通知
 */
import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/tauri';
import { CloudService, type AccountCookieStatus } from './cloud';
import { configStore } from '@/utils/config-store';
import { notification } from '@/utils';
import { realtimePushService } from './realtime-push';
import { AccountSyncService } from './account-sync';
import { useBrowserStore } from '@/store/modules/browser';
import { PushDataHandler } from './push-data-handler';
import type { CloudPushData } from '@/types/push';

/**
 * 状态缓存配置
 */
const CACHE_DURATION = 10 * 60 * 1000; // 缓存10分钟

/**
 * 云端状态缓存存储
 * browser_id -> CloudStatusCache
 */
const cloudStatusCache = ref<Record<string, Cookie.CloudStatusCache>>({});

/**
 * Cookie失效通知防抖
 * 收集5秒内的所有失效账号，统一发送一个通知
 */
const expiredAccountsBuffer: string[] = [];
let expiredNotificationTimer: NodeJS.Timeout | null = null;

/**
 * 是否正在同步
 */
const isSyncing = ref(false);

/**
 * 上次同步时间
 */
const lastSyncTime = ref<number>(0);

/**
 * 标准化Cookie状态
 * 将云端返回的各种状态统一为4种标准状态
 */
function normalizeCookieStatus(status: any): 'pending' | 'online' | 'offline' | 'checking' {
  if (!status) return 'pending';

  const normalizedStatus = String(status).toLowerCase();

  switch (normalizedStatus) {
    case 'online':
      return 'online';
    case 'offline':
      return 'offline';
    case 'checking':
      return 'checking';
    default:
      // 所有其他状态（pending, unknown, not_found等）都归为 pending
      return 'pending';
  }
}

/**
 * 账号状态监控服务
 */
export class AccountMonitorService {
  /**
   * 启动监控服务
   */
  static async start() {
    // ✅ 优先订阅 Realtime 推送（秒级完成，立即可用）
    const { success: realtimeSubscribed, reason } = await this.subscribeToRealtimeUpdates();

    if (!realtimeSubscribed && reason !== 'no_accounts') {
      console.warn('[账号监控] Realtime不可用，将无法接收Cookie失效的实时通知');
    }

    // ✅ 后台同步云端状态（可能慢，但不阻塞 Realtime）
    // 即使失败也不影响 Realtime 推送功能
    this.syncAllStatus().catch(error => {
      console.warn('[账号监控] 后台同步失败（不影响 Realtime）:', error);
    });
  }

  /**
   * 订阅Realtime实时推送（支持用户筛选）
   */
  private static async subscribeToRealtimeUpdates(): Promise<{ success: boolean; reason?: string }> {
    try {
      // 获取用户筛选配置
      const filterMyAccounts = await configStore.getFilterMyAccounts();
      const currentUserName = await configStore.getUsername();

      // 获取所有已注册账号
      const allAccounts = await configStore.getBrowserAccounts();
      let browserIds = Object.keys(allAccounts);

      console.log(`[账号监控] 配置文件中共有 ${browserIds.length} 个账号`);

      // 如果启用了用户筛选，只订阅该用户创建的浏览器对应的账号
      if (filterMyAccounts && currentUserName) {
        // 获取比特浏览器列表（应用用户筛选）
        const params: any = {
          page: 0,
          pageSize: 1000,
          createdName: currentUserName
        };

        const response = await invoke<any>('get_browser_list', params);

        if (response.success && response.data?.list) {
          const userBrowserIds = response.data.list.map((b: any) => b.id);
          console.log(`[账号监控] 比特浏览器中有 ${userBrowserIds.length} 个 ${currentUserName} 的浏览器`);

          // 找出配置中有但比特浏览器中没有的账号（已删除的浏览器）
          const missingInBitBrowser = browserIds.filter(id => !userBrowserIds.includes(id));
          if (missingInBitBrowser.length > 0) {
            console.warn(`[账号监控] 发现 ${missingInBitBrowser.length} 个已删除的浏览器（将自动清理）`);
          }

          // 找出比特浏览器中有但配置中没有的账号（新创建的浏览器）
          const newBrowserIds = userBrowserIds.filter((id: string) => !browserIds.includes(id));
          if (newBrowserIds.length > 0) {
            console.log(`[账号监控] 发现 ${newBrowserIds.length} 个新浏览器，将订阅它们:`, newBrowserIds);
          }

          // ✅ 使用比特浏览器中的所有用户浏览器（包括新创建的）
          browserIds = userBrowserIds;
        } else {
          console.error('[账号监控] 获取浏览器列表失败，将订阅所有账号');
        }
      }

      if (browserIds.length === 0) {
        return { success: false, reason: 'no_accounts' };
      }

      // ✅ 订阅Realtime推送（使用统一推送处理器）
      const callback = async (data: CloudPushData) => {
        if (!data.browserId) {
          return;
        }

        try {
          // ✅ 使用统一推送处理器
          const result = await PushDataHandler.processUpdate(
            data,
            cloudStatusCache.value,
            expiredAccountsBuffer
          );

          if (!result.success) {
            console.error(`[账号监控] 推送处理失败: ${data.browserId}`, result.error);
            return;
          }

          // ✅ 创建新对象引用，触发 Vue 响应式更新
          cloudStatusCache.value = {
            ...cloudStatusCache.value,
            [data.browserId]: result.cached
          };

          // 保存缓存
          await this.saveCacheToStorage();

          // ✅ 启动防抖定时器（5秒后统一发送失效通知）
          if (expiredAccountsBuffer.length > 0) {
            if (expiredNotificationTimer) {
              clearTimeout(expiredNotificationTimer);
            }
            expiredNotificationTimer = setTimeout(() => {
              if (expiredAccountsBuffer.length > 0) {
                this.notifyExpiredAccounts([...expiredAccountsBuffer]);
                expiredAccountsBuffer.length = 0; // 清空缓冲区
              }
              expiredNotificationTimer = null;
            }, 5000);
          }
        } catch (error) {
          console.error(`[账号监控] 推送处理异常: ${data.browserId}`, error);
        }
      };

      // ✅ 先批量查询云端状态，只订阅存在的账号
      console.log(`[账号监控] 正在验证 ${browserIds.length} 个账号是否存在于云端...`);
      const cloudResult = await CloudService.batchCheckStatus(browserIds);

      if (!cloudResult) {
        console.warn(`[账号监控] 云端查询失败，跳过订阅`);
        return { success: false, reason: 'cloud_query_failed' };
      }

      // 只订阅云端存在的账号
      const existingBrowserIds = Object.keys(cloudResult.accounts);
      console.log(`[账号监控] 云端存在 ${existingBrowserIds.length}/${browserIds.length} 个账号`);

      // 为每个存在的账号订阅
      let successCount = 0;
      existingBrowserIds.forEach(browserId => {
        if (realtimePushService.subscribe(browserId, callback)) {
          successCount++;
        }
      });

      const success = successCount > 0;

      // ✅ 输出订阅结果日志
      if (success) {
        console.log(`[账号监控] ✅ 已订阅 ${successCount}/${existingBrowserIds.length} 个账号的 Realtime 推送`);
      } else {
        console.warn(`[账号监控] ⚠️ Realtime 订阅失败，browserIds: ${existingBrowserIds.length}`);
      }

      return { success };
    } catch (error) {
      console.error('[账号监控] 订阅Realtime失败:', error);
      return { success: false, reason: 'error' };
    }
  }

  /**
   * 确保账号被订阅（如果已订阅则跳过）
   * 用于添加账号流程中，确保账号能收到 Realtime 推送
   * @param browserId 浏览器ID
   * @param additionalCallback 额外的回调函数（用于特定流程的事件处理）
   * @returns 是否成功订阅（如果已订阅也返回 true）
   */
  static ensureSubscribed(
    browserId: string,
    additionalCallback?: (data: any) => void
  ): boolean {
    // 检查是否已经订阅（通过查看缓存）
    const alreadySubscribed = !!cloudStatusCache.value[browserId];

    if (alreadySubscribed) {
      // 即使已订阅，如果提供了额外的回调，也需要注册
      if (additionalCallback) {
        realtimePushService.subscribe(browserId, additionalCallback);
      }
      return true;
    }

    // 如果未订阅，则订阅（不需要 accountInfo，因为后续会保存完整的账号信息）
    return this.subscribeNewAccount(browserId, undefined, additionalCallback);
  }

  /**
   * 订阅新账号（动态添加）
   * @param browserId 浏览器ID
   * @param accountInfo 账号信息（用于失效通知）
   * @param additionalCallback 额外的回调函数（用于特定流程的事件处理）
   * @returns 是否成功订阅
   */
  static subscribeNewAccount(
    browserId: string,
    accountInfo?: { nickname?: string },
    additionalCallback?: (data: CloudPushData) => void
  ): boolean {
    // ✅ 注册监控回调（使用统一推送处理器）
    const callback = async (data: CloudPushData) => {
      if (!data.browserId) {
        return;
      }

      try {
        // ✅ 使用统一推送处理器（复用逻辑）
        const result = await PushDataHandler.processUpdate(
          data,
          cloudStatusCache.value,
          expiredAccountsBuffer
        );

        if (!result.success) {
          console.error(`[账号监控] 推送处理失败: ${data.browserId}`, result.error);
          return;
        }

        // ✅ 创建新对象引用，触发 Vue 响应式更新
        cloudStatusCache.value = {
          ...cloudStatusCache.value,
          [data.browserId]: result.cached
        };

        // 保存缓存
        await this.saveCacheToStorage();

        // ✅ 启动防抖定时器（5秒后统一发送失效通知）
        if (expiredAccountsBuffer.length > 0) {
          if (expiredNotificationTimer) {
            clearTimeout(expiredNotificationTimer);
          }
          expiredNotificationTimer = setTimeout(() => {
            if (expiredAccountsBuffer.length > 0) {
              AccountMonitorService.notifyExpiredAccounts([...expiredAccountsBuffer]);
              expiredAccountsBuffer.length = 0; // 清空缓冲区
            }
            expiredNotificationTimer = null;
          }, 5000);
        }
      } catch (error) {
        console.error(`[账号监控] 推送处理异常: ${data.browserId}`, error);
      }
    };

    const success = realtimePushService.subscribe(browserId, callback);

    if (success) {
      // 如果提供了额外的回调，也注册它
      if (additionalCallback) {
        realtimePushService.subscribe(browserId, additionalCallback);
      }

      // ✅ 订阅成功，但不初始化缓存
      // 让 Realtime 推送或主动刷新来填充真实状态，避免显示错误的 'pending' 状态
      console.log(`[账号监控] 已订阅 ${browserId}，等待 Realtime 推送或主动刷新填充状态`);
    }

    return success;
  }

  /**
   * 停止监控服务
   */
  static stop() {
    // 取消Realtime订阅
    // 这里可以添加取消订阅的逻辑
  }

  /**
   * 同步所有账号状态
   */
  static async syncAllStatus(): Promise<void> {
    if (isSyncing.value) {
      return;
    }

    try {
      isSyncing.value = true;

      // 获取用户筛选配置
      const filterMyAccounts = await configStore.getFilterMyAccounts();
      const currentUserName = await configStore.getUsername();

      // 获取所有已注册账号
      const allAccounts = await configStore.getBrowserAccounts();
      let browserIds = Object.keys(allAccounts);

      // 如果启用了用户筛选，只同步该用户创建的浏览器对应的账号
      if (filterMyAccounts && currentUserName) {
        // 获取比特浏览器列表（应用用户筛选）
        const params: any = {
          page: 0,
          pageSize: 1000,
          createdName: currentUserName
        };

        const response = await invoke<any>('get_browser_list', params);

        if (response.success && response.data?.list) {
          const userBrowserIds = response.data.list.map((b: any) => b.id);
          console.log(`[账号监控-批量检测] 比特浏览器中有 ${userBrowserIds.length} 个 ${currentUserName} 的浏览器`);

          // 找出配置中有但比特浏览器中没有的账号（已删除的浏览器）
          const missingInBitBrowser = browserIds.filter(id => !userBrowserIds.includes(id));
          if (missingInBitBrowser.length > 0) {
            console.warn(`[账号监控-批量检测] 发现 ${missingInBitBrowser.length} 个已删除的浏览器（将跳过检测）`);
          }

          // 找出比特浏览器中有但配置中没有的账号（新创建的浏览器）
          const newBrowserIds = userBrowserIds.filter((id: string) => !browserIds.includes(id));
          if (newBrowserIds.length > 0) {
            console.log(`[账号监控-批量检测] 发现 ${newBrowserIds.length} 个新浏览器，将检测它们:`, newBrowserIds);
          }

          // ✅ 使用比特浏览器中的所有用户浏览器（包括新创建的）
          browserIds = userBrowserIds;
        } else {
          console.error('[账号监控] 获取浏览器列表失败，将同步所有账号');
        }
      }

      if (browserIds.length === 0) {
        return;
      }

      // 批量查询云端状态
      const result = await CloudService.batchCheckStatus(browserIds);

      if (!result) {
        console.error('[账号监控] 云端查询失败');
        return;
      }

      // ✅ 自动同步本地有但云端没有的账号
      const missingBrowserIds = browserIds.filter(id => !result.accounts[id]);
      if (missingBrowserIds.length > 0) {
        try {
          // 调用自动发现功能，只处理这些缺失的浏览器
          await this.syncMissingAccounts(missingBrowserIds, allAccounts);
        } catch (error) {
          console.error('[账号监控] 自动同步失败:', error);
        }
      }

      // 更新缓存
      const now = Date.now();
      const expiredAccounts: string[] = [];

      // ✅ 批量更新缓存（创建新对象引用，触发响应式更新）
      const newCache = { ...cloudStatusCache.value };
      for (const [browserId, status] of Object.entries(result.accounts)) {
        // 更新缓存（包含accountInfo）
        newCache[browserId] = {
          cookieStatus: normalizeCookieStatus(status.cookieStatus),
          lastCheckTime: status.lastCheckTime,
          lastValidTime: status.lastValidTime,
          cookieUpdatedAt: status.cookieUpdatedAt,
          cookieExpiredAt: status.cookieExpiredAt,
          checkErrorCount: status.checkErrorCount,
          cachedAt: now,
          accountInfo: status.accountInfo  // ✅ 添加 accountInfo
        };

        // 检测失效账号
        if (status.cookieStatus === 'offline') {
          const account = allAccounts[browserId];
          if (account) {
            expiredAccounts.push(account.accountInfo.nickname || browserId);
          }
        }
      }

      // ✅ 应用批量更新
      cloudStatusCache.value = newCache;

      // ✅ 清理本地配置中不存在于比特浏览器的账号（已删除的浏览器）
      const allBrowserIds = Object.keys(allAccounts);  // 本地配置中的所有账号
      const deletedBrowserIds = allBrowserIds.filter(id => !browserIds.includes(id));  // 比特浏览器中不存在的

      if (deletedBrowserIds.length > 0) {
        console.log(`[账号监控] 清理 ${deletedBrowserIds.length} 个已删除浏览器的配置和缓存`);

        // ✅ 清理本地配置文件中的账号记录
        for (const browserId of deletedBrowserIds) {
          try {
            await configStore.deleteBrowserAccount(browserId);
            console.log(`[账号监控]   已删除配置: ${browserId}`);
          } catch (error) {
            console.error(`[账号监控]   清理配置失败: ${browserId}`, error);
          }
        }

        // 清理内存缓存
        deletedBrowserIds.forEach(browserId => {
          if (cloudStatusCache.value[browserId]) {
            delete cloudStatusCache.value[browserId];
          }
        });
      }

      // 更新同步时间
      lastSyncTime.value = now;

      // 保存缓存到本地存储（可选）
      await this.saveCacheToStorage();

      // 发送失效通知
      if (expiredAccounts.length > 0) {
        this.notifyExpiredAccounts(expiredAccounts);
      }
    } catch (error) {
      console.error('[账号监控] 同步失败:', error);
    } finally {
      isSyncing.value = false;
    }
  }

  /**
   * 获取单个账号的状态（优先从缓存读取）
   */
  static getAccountStatus(browserId: string): Cookie.CloudStatusCache | null {
    const cached = cloudStatusCache.value[browserId];

    if (!cached) {
      // ✅ 缓存未命中时触发后台刷新（不阻塞返回）
      // 解决刚登录后立即访问时的时序问题（Realtime推送可能还没到达）
      this.refreshAccountStatus(browserId).catch(err => {
        console.error(`[账号监控] 后台刷新失败: ${browserId}`, err);
      });
      return null;
    }

    return cached;
  }

  /**
   * 刷新单个账号状态（后台异步）
   */
  static async refreshAccountStatus(browserId: string): Promise<void> {
    try {
      const status = await CloudService.checkAccountStatus(browserId);

      if (!status) {
        // ✅ 账号不存在（可能已删除），自动清理订阅和缓存
        console.log(`[账号监控] 账号不存在，自动清理: ${browserId}`);
        await realtimePushService.unsubscribe(browserId);
        this.clearAccountCache(browserId);
        return;
      }

      // ✅ 创建新对象引用，触发响应式更新
      cloudStatusCache.value = {
        ...cloudStatusCache.value,
        [browserId]: {
          cookieStatus: normalizeCookieStatus(status.cookieStatus),
          lastCheckTime: status.lastCheckTime,
          lastValidTime: status.lastValidTime,
          cookieUpdatedAt: status.cookieUpdatedAt,
          cookieExpiredAt: status.cookieExpiredAt,
          checkErrorCount: status.checkErrorCount,
          cachedAt: Date.now(),
          accountInfo: status.accountInfo
        }
      };

      await this.saveCacheToStorage();
    } catch (error: any) {
      // ✅ 如果是404错误，也自动清理
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.log(`[账号监控] 账号不存在(404)，自动清理: ${browserId}`);
        await realtimePushService.unsubscribe(browserId);
        this.clearAccountCache(browserId);
      } else {
        console.error(`[账号监控] 刷新失败: ${browserId}`, error);
      }
    }
  }

  /**
   * 获取所有账号状态摘要
   */
  static getStatusSummary() {
    const statuses = Object.values(cloudStatusCache.value);

    return {
      total: statuses.length,
      online: statuses.filter(s => s.cookieStatus === 'online').length,
      offline: statuses.filter(s => s.cookieStatus === 'offline').length,
      pending: statuses.filter(s => s.cookieStatus === 'pending').length,
      lastSyncTime: lastSyncTime.value
    };
  }

  /**
   * 发送失效账号通知
   */
  private static notifyExpiredAccounts(accounts: string[]) {
    const message = `${accounts.length} 个账号已掉线，需要重新登录`;

    notification.warning(message, {
      duration: 10000,
      meta: accounts.join('、')
    });
  }

  /**
   * 保存缓存到本地存储
   */
  private static async saveCacheToStorage() {
    try {
      // 使用 configStore 保存到本地
      // 这里可以根据实际情况调整存储位置
      localStorage.setItem('cloud_status_cache', JSON.stringify({
        cache: cloudStatusCache.value,
        lastSyncTime: lastSyncTime.value
      }));
    } catch (error) {
      console.error('[账号监控] 保存缓存失败:', error);
    }
  }

  /**
   * 从本地存储加载缓存（自动清理无效缓存）
   */
  static async loadCacheFromStorage() {
    try {
      const data = localStorage.getItem('cloud_status_cache');
      if (data) {
        const parsed = JSON.parse(data);
        cloudStatusCache.value = parsed.cache || {};
        lastSyncTime.value = parsed.lastSyncTime || 0;

        const loadedCount = Object.keys(cloudStatusCache.value).length;

        // 获取当前实际存在的账号列表
        const allAccounts = await configStore.getBrowserAccounts();
        const existingBrowserIds = Object.keys(allAccounts);

        // 清理不存在的账号缓存
        const cacheKeys = Object.keys(cloudStatusCache.value);
        const invalidKeys = cacheKeys.filter(key => !existingBrowserIds.includes(key));

        if (invalidKeys.length > 0) {
          console.log(`[账号监控] 清理 ${invalidKeys.length} 个无效缓存`);
          invalidKeys.forEach(key => {
            delete cloudStatusCache.value[key];
          });

          // 保存清理后的缓存
          await this.saveCacheToStorage();
        }

        // 只在有缓存数据时才输出日志
        const validCount = Object.keys(cloudStatusCache.value).length;
        if (validCount > 0) {
          console.log(`[账号监控] 已加载 ${validCount} 个账号缓存${invalidKeys.length > 0 ? `（已清理 ${invalidKeys.length} 个）` : ''}`);
        }
      }
    } catch (error) {
      console.error('[账号监控] 加载缓存失败:', error);
    }
  }

  /**
   * 手动设置账号状态（不触发订阅）
   * 用于状态迁移或直接更新缓存
   */
  static setAccountStatus(browserId: string, status: Cookie.CloudStatusCache): void {
    cloudStatusCache.value = {
      ...cloudStatusCache.value,
      [browserId]: status
    };
    this.saveCacheToStorage();
  }

  /**
   * 清除所有缓存
   */
  static clearCache() {
    cloudStatusCache.value = {};
    lastSyncTime.value = 0;
    localStorage.removeItem('cloud_status_cache');
  }

  /**
   * 清除单个账号的缓存
   * 用于状态迁移（虚拟ID → 真实ID），避免触发false通知
   */
  static clearAccountCache(browserId: string): void {
    if (cloudStatusCache.value[browserId]) {
      const newCache = { ...cloudStatusCache.value };
      delete newCache[browserId];
      cloudStatusCache.value = newCache;
      console.log(`[账号监控] 已清理缓存: ${browserId}`);
    }
  }

  /**
   * 同步本地有但云端没有的账号
   */
  private static async syncMissingAccounts(
    missingBrowserIds: string[],
    allAccounts: Record<string, Cookie.AccountData>
  ): Promise<void> {
    let successCount = 0;
    let failCount = 0;

    for (const browserId of missingBrowserIds) {
      try {
        // 1. 获取浏览器Cookie
        const cookieResponse = await invoke<any>('get_browser_cookies', {
          browserId
        });

        if (!cookieResponse.success) {
          failCount++;
          continue;
        }

        const cookies = (cookieResponse.data?.cookies || []) as Array<{ name: string; value: string; domain: string }>;

        // 2. 识别Cookie类型
        const loginMethod = this.detectLoginMethod(cookies);

        // 3. 格式化Cookie
        const formattedCookies = cookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
          path: '/',
          secure: true,
          httpOnly: false
        }));

        // 4. 读取本地账号信息
        const localAccount = allAccounts[browserId];

        // 5. 调用云端注册
        const registerResult = await CloudService.autoRegisterBrowser(
          browserId,
          formattedCookies,
          loginMethod,
          localAccount?.accountInfo
        );

        if (!registerResult) {
          failCount++;
          continue;
        }

        // 6. 更新本地配置
        const accountInfo = registerResult.accountInfo || localAccount?.accountInfo || {
          nickname: '未知账号',
          avatar: ''
        };

        await configStore.saveBrowserAccount(browserId, {
          browserId,
          accountInfo,
          loginMethod,
          loginTime: localAccount?.loginTime || Date.now(),
          updatedAt: new Date().toISOString(),
          lastSyncTime: Date.now()
        });

        // 7. 更新缓存（包含accountInfo）✅ 创建新对象引用
        const normalizedStatus = normalizeCookieStatus(registerResult.cookieStatus);
        cloudStatusCache.value = {
          ...cloudStatusCache.value,
          [browserId]: {
            cookieStatus: normalizedStatus,
            lastCheckTime: new Date().toISOString(),
            lastValidTime: normalizedStatus === 'online' ? new Date().toISOString() : null,
            cookieUpdatedAt: null,
            cookieExpiredAt: null,
            checkErrorCount: 0,
            cachedAt: Date.now(),
            accountInfo: registerResult.accountInfo ? {
              nickname: registerResult.accountInfo.nickname || accountInfo.nickname,
              avatar: registerResult.accountInfo.avatar || accountInfo.avatar,
              loginMethod: loginMethod
            } : null
          }
        };

        successCount++;

      } catch (error) {
        console.error(`[账号监控] 同步账号 ${browserId} 时出错:`, error);
        failCount++;
      }
    }

    // 保存缓存
    if (successCount > 0) {
      await this.saveCacheToStorage();
    }
  }

  /**
   * 识别Cookie类型（内部方法）
   */
  private static detectLoginMethod(cookies: Array<{ name: string }>): 'channels_helper' | 'shop_helper' {
    if (!cookies || cookies.length === 0) {
      return 'channels_helper';
    }

    const cookieNames = cookies.map(c => c.name);

    // 带货助手（小店助手）特征：talent_token
    if (cookieNames.includes('talent_token')) {
      return 'shop_helper';
    }

    // 视频号助手特征：sessionid 或 wxuin
    if (cookieNames.includes('sessionid') || cookieNames.includes('wxuin')) {
      return 'channels_helper';
    }

    // 默认：视频号助手
    return 'channels_helper';
  }
}

/**
 * 导出响应式状态（供组件使用）
 */
export const accountMonitorState = {
  cloudStatusCache: computed(() => cloudStatusCache.value),
  isSyncing: computed(() => isSyncing.value),
  lastSyncTime: computed(() => lastSyncTime.value),
  statusSummary: computed(() => AccountMonitorService.getStatusSummary())
};
