/**
 * 统一账号同步服务
 *
 * 职责：统一处理所有Cookie同步场景
 * - 云端→本地：云端有Cookie，本地无Cookie → 同步到本地
 * - 本地→云端：本地有Cookie，云端无记录 → 注册到云端
 *
 * 触发场景：
 * 1. 启动时全量同步（双向）
 * 2. Realtime推送触发（由 realtimePushService + AccountMonitorService 管理）
 * 3. 手动触发（支持双向）
 *
 * 注意：
 * - Realtime 订阅由全局 realtimePushService 统一管理
 * - AccountMonitorService 负责订阅管理和回调处理
 * - 本服务只提供同步逻辑，不创建独立的 Realtime 订阅
 */

import { invoke } from '@tauri-apps/api/tauri';
import { CloudService } from './cloud';
import { configStore } from '@/utils/config-store';
import { notification } from '@/utils';
import { apiLimiter } from '@/utils/api-limiter';

/**
 * Cookie类型
 */
type CookieType = 'channels_helper' | 'shop_helper';

/**
 * Cookie信息
 */
interface CookieInfo {
  name: string;
  value: string;
  domain: string;
}

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean;
  action?: 'cloud_to_local' | 'local_to_cloud' | 'skip' | 'delete';
  message?: string;
  accountInfo?: {
    nickname: string;
    avatar: string;
    loginMethod: string;
  };
}

/**
 * 全量同步结果
 */
export interface FullSyncResult {
  total: number;
  cloudToLocal: number;    // 云端→本地同步数
  localToCloud: number;    // 本地→云端注册数
  skipped: number;         // 跳过数
  failed: number;          // 失败数
  syncedAccounts: Array<{
    browserId: string;
    nickname: string;
    action: 'cloud_to_local' | 'local_to_cloud';
  }>;
}

/**
 * 识别Cookie类型
 */
function detectCookieType(cookies: CookieInfo[]): CookieType {
  if (!cookies || cookies.length === 0) {
    return 'channels_helper';
  }

  const cookieNames = cookies.map(c => c.name);

  // 带货助手：talent_token
  if (cookieNames.includes('talent_token')) {
    return 'shop_helper';
  }

  // 视频号助手：sessionid 或 wxuin
  if (cookieNames.includes('sessionid') || cookieNames.includes('wxuin')) {
    return 'channels_helper';
  }

  // 默认视频号助手
  return 'channels_helper';
}

/**
 * 格式化Cookie为标准格式
 */
function formatCookiesForCloud(cookies: CookieInfo[]): any[] {
  return cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
    path: '/',
    secure: true,
    httpOnly: false
  }));
}

/**
 * 统一账号同步服务
 *
 * 注意：Realtime 订阅由 realtimePushService 全局管理
 * 本服务只负责同步逻辑，不创建独立的 Realtime 订阅
 */
export class AccountSyncService {
  /**
   * 同步单个浏览器账号
   *
   * 状态矩阵：
   * | 本地Cookie | 云端记录 | 云端Cookie | 操作                |
   * |-----------|---------|-----------|---------------------|
   * | 无        | 无      | -         | 跳过（等待用户登录）  |
   * | 无        | 有      | 无        | 跳过（等待云端推送）  |
   * | 无        | 有      | 有        | 云端→本地           |
   * | 有        | 无      | -         | 本地→云端（注册）     |
   * | 有        | 有      | 无        | 本地→云端（更新）     |
   * | 有        | 有      | 有        | 对比时间戳，更新旧的  |
   *
   * @param browserId 浏览器ID
   * @param force 强制同步（忽略时间戳对比）
   */
  static async syncSingle(browserId: string, force: boolean = false): Promise<SyncResult> {
    try {
      // 1. 获取本地注册状态
      const registeredAccounts = await configStore.getBrowserAccounts();
      const isRegistered = !!registeredAccounts[browserId];

      // 2. 获取本地Cookie
      let localCookies: CookieInfo[] = [];
      try {
        const response = await invoke<any>('get_browser_cookies', { browserId });
        if (response.success && response.data?.cookies) {
          localCookies = response.data.cookies;
        }
      } catch (error) {
        console.error(`[账号同步] 获取本地Cookie失败: ${browserId}`, error);
      }

      const hasLocalCookie = localCookies.length > 0;

      // 3. 查询云端状态
      let cloudStatus = null;
      try {
        cloudStatus = await CloudService.checkAccountStatus(browserId);
      } catch (error) {
        console.error(`[账号同步] 查询云端状态失败: ${browserId}`, error);
      }

      const hasCloudRecord = !!cloudStatus;
      const hasCloudCookie = cloudStatus?.cookieStatus === 'online' ||
                            (cloudStatus?.accountInfo?.nickname && cloudStatus?.accountInfo?.loginMethod);

      // 4. 状态矩阵判断

      // 场景1: 本地无Cookie + 云端无记录 → 跳过
      if (!hasLocalCookie && !hasCloudRecord) {
        return { success: true, action: 'skip', message: '等待用户登录' };
      }

      // 场景2: 本地无Cookie + 云端有记录但无Cookie → 跳过
      if (!hasLocalCookie && hasCloudRecord && !hasCloudCookie) {
        return { success: true, action: 'skip', message: '等待云端Cookie推送' };
      }

      // 场景3: 本地无Cookie + 云端有Cookie → 云端→本地
      if (!hasLocalCookie && hasCloudRecord && hasCloudCookie) {
        return await this.syncFromCloudToLocal(browserId, cloudStatus!, isRegistered);
      }

      // 场景4: 本地有Cookie + 云端无记录 → 本地→云端（注册）
      if (hasLocalCookie && !hasCloudRecord) {
        return await this.syncFromLocalToCloud(browserId, localCookies, false);
      }

      // 场景5: 本地有Cookie + 云端有记录但无Cookie → 本地→云端（更新）
      if (hasLocalCookie && hasCloudRecord && !hasCloudCookie) {
        return await this.syncFromLocalToCloud(browserId, localCookies, true);
      }

      // 场景6: 本地有Cookie + 云端有Cookie → 以云端为准
      if (hasLocalCookie && hasCloudRecord && hasCloudCookie) {
        if (force) {
          return await this.syncFromCloudToLocal(browserId, cloudStatus!, isRegistered);
        }

        // 对比时间戳：云端Cookie更新时间 vs 本地最后同步时间
        const localAccount = registeredAccounts[browserId];
        const localSyncTime = localAccount?.lastSyncTime || 0;
        const cloudUpdateTime = cloudStatus.cookieUpdatedAt
          ? new Date(cloudStatus.cookieUpdatedAt).getTime()
          : 0;

        // 原则：云端是唯一可信源，只有当云端Cookie更新时间 > 本地同步时间时，才需要同步
        if (cloudUpdateTime > localSyncTime) {
          return await this.syncFromCloudToLocal(browserId, cloudStatus!, isRegistered);
        }

        // 云端Cookie没有更新 → 跳过
        return { success: true, action: 'skip', message: '云端Cookie无更新' };
      }

      // 兜底：跳过
      return { success: true, action: 'skip', message: '未匹配任何同步场景' };

    } catch (error) {
      console.error(`[账号同步] 同步失败: ${browserId}`, error);
      return { success: false, message: error instanceof Error ? error.message : '同步失败' };
    }
  }

  /**
   * 云端→本地同步
   */
  private static async syncFromCloudToLocal(
    browserId: string,
    cloudStatus: any,
    isRegistered: boolean
  ): Promise<SyncResult> {
    try {
      // 1. cloudStatus 已经包含了账号信息，直接使用 syncCookieFromCloud API
      const syncResult = await CloudService.syncCookieFromCloud(browserId);

      if (!syncResult.cookies || syncResult.cookies.length === 0) {
        return { success: false, message: '云端Cookie为空' };
      }

      // 2. 格式化Cookie字符串
      const cookie = syncResult.cookies
        .map((c: any) => `${c.name}=${c.value}`)
        .join('; ');

      // 3. 同步到比特浏览器（只同步 Cookie，不更新名称）- 应用限流器
      await apiLimiter.runInternal(() =>
        invoke('sync_cookie_to_browser', {
          browserId,
          cookie
        })
      );

      // 4. 更新或保存本地账号信息
      const accountInfo = {
        nickname: syncResult.nickname || cloudStatus.accountInfo?.nickname || '未知用户',
        avatar: syncResult.avatar || cloudStatus.accountInfo?.avatar || '',
        wechatId: cloudStatus.accountInfo?.wechatId,
        finderUsername: cloudStatus.accountInfo?.finderUsername,
        appuin: cloudStatus.accountInfo?.appuin
      };

      await configStore.saveBrowserAccount(browserId, {
        browserId,
        accountInfo,
        loginMethod: syncResult.loginMethod || cloudStatus.accountInfo?.loginMethod || 'channels_helper',
        loginTime: Date.now(),
        updatedAt: new Date().toISOString(),
        lastSyncTime: Date.now()
      });

      // ✅ 更新 browserStore 的内存数据，确保 UI 立即刷新
      const { useBrowserStore } = await import('@/store/modules/browser');
      const browserStore = useBrowserStore();
      browserStore.updateAccountInfo(browserId, accountInfo);

      return {
        success: true,
        action: 'cloud_to_local',
        message: '云端→本地同步成功',
        accountInfo: {
          nickname: accountInfo.nickname,
          avatar: accountInfo.avatar,
          loginMethod: syncResult.loginMethod || 'channels_helper'
        }
      };
    } catch (error) {
      console.error(`[账号同步] 云端→本地失败: ${browserId}`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '云端→本地同步失败'
      };
    }
  }

  /**
   * 本地→云端同步（注册或更新）
   */
  private static async syncFromLocalToCloud(
    browserId: string,
    localCookies: CookieInfo[],
    isUpdate: boolean
  ): Promise<SyncResult> {
    try {
      // 1. 识别Cookie类型
      const cookieType = detectCookieType(localCookies);

      // 2. 格式化Cookie
      const formattedCookies = formatCookiesForCloud(localCookies);

      // 3. 调用云端自动注册API（原子化操作：验证+注册）
      const registerResult = await CloudService.autoRegisterBrowser(
        browserId,
        formattedCookies,
        cookieType,
        undefined // accountInfo由云端验证后自动获取
      );

      if (!registerResult) {
        return { success: false, message: '云端注册失败' };
      }

      // 4. 保存到本地配置
      const accountInfo = {
        nickname: registerResult.accountInfo?.nickname || '未知用户',
        avatar: registerResult.accountInfo?.avatar || '',
        wechatId: registerResult.accountInfo?.wechatId,
        finderUsername: registerResult.accountInfo?.finderUsername,
        appuin: registerResult.accountInfo?.appuin
      };

      await configStore.saveBrowserAccount(browserId, {
        browserId,
        accountInfo,
        loginMethod: cookieType,
        loginTime: Date.now(),
        updatedAt: new Date().toISOString(),
        lastSyncTime: Date.now()
      });

      return {
        success: true,
        action: 'local_to_cloud',
        message: isUpdate ? '本地→云端更新成功' : '本地→云端注册成功',
        accountInfo: {
          nickname: accountInfo.nickname,
          avatar: accountInfo.avatar,
          loginMethod: cookieType
        }
      };
    } catch (error) {
      console.error(`[账号同步] 本地→云端失败: ${browserId}`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '本地→云端同步失败'
      };
    }
  }

  /**
   * 启动时全量双向同步
   *
   * 工作流程：
   * 1. 获取所有本地已注册账号
   * 2. 获取所有本地比特浏览器（支持用户筛选）
   * 3. 对每个浏览器执行 syncSingle()
   *
   * @param options 同步选项
   * @param options.filterUserName 可选的用户名筛选（只同步该用户创建的浏览器）
   * @param options.autoApplyUserFilter 自动应用用户筛选配置（默认 true）
   */
  static async fullSync(options?: {
    filterUserName?: string;
    autoApplyUserFilter?: boolean;
  }): Promise<FullSyncResult> {
    const result: FullSyncResult = {
      total: 0,
      cloudToLocal: 0,
      localToCloud: 0,
      skipped: 0,
      failed: 0,
      syncedAccounts: []
    };

    try {
      // 1. 确定用户筛选配置
      let filterUserName = options?.filterUserName;

      // 如果没有明确指定，但启用了自动应用用户筛选
      if (!filterUserName && (options?.autoApplyUserFilter !== false)) {
        const filterMyAccounts = await configStore.getFilterMyAccounts();
        if (filterMyAccounts) {
          filterUserName = await configStore.getUsername();
        }
      }

      // 2. 获取所有比特浏览器列表（应用用户筛选）
      const params: any = {
        page: 0,
        pageSize: 1000
      };

      if (filterUserName) {
        params.createdName = filterUserName;
      }

      const response = await invoke<any>('get_browser_list', params);

      if (!response.success || !response.data?.list) {
        console.error('[账号同步] 获取浏览器列表失败');
        return result;
      }

      const browsers = response.data.list;
      result.total = browsers.length;

      // 2. 逐个同步
      for (const browser of browsers) {
        try {
          const syncResult = await this.syncSingle(browser.id);

          if (!syncResult.success) {
            result.failed++;
            continue;
          }

          if (syncResult.action === 'skip') {
            result.skipped++;
            continue;
          }

          if (syncResult.action === 'cloud_to_local') {
            result.cloudToLocal++;
            result.syncedAccounts.push({
              browserId: browser.id,
              nickname: syncResult.accountInfo?.nickname || browser.name,
              action: 'cloud_to_local'
            });
          }

          if (syncResult.action === 'local_to_cloud') {
            result.localToCloud++;
            result.syncedAccounts.push({
              browserId: browser.id,
              nickname: syncResult.accountInfo?.nickname || browser.name,
              action: 'local_to_cloud'
            });
          }
        } catch (error) {
          console.error(`[账号同步] 同步浏览器 ${browser.id} 失败:`, error);
          result.failed++;
        }
      }

      // 3. 显示通知
      const totalSynced = result.cloudToLocal + result.localToCloud;
      if (totalSynced > 0) {
        const messages: string[] = [];
        if (result.cloudToLocal > 0) {
          messages.push(`云端→本地 ${result.cloudToLocal}个`);
        }
        if (result.localToCloud > 0) {
          messages.push(`本地→云端 ${result.localToCloud}个`);
        }

        const displayNames = result.syncedAccounts.slice(0, 3).map(a => a.nickname).join('、');
        const meta = result.syncedAccounts.length > 3
          ? `${displayNames} 等${result.syncedAccounts.length}个`
          : displayNames;

        notification.success(
          `已同步 ${totalSynced} 个账号（${messages.join('，')}}）`,
          {
            title: '账号同步完成',
            duration: 5000,
            meta
          }
        );
      }

      return result;

    } catch (error) {
      console.error('[账号同步] 全量同步失败:', error);
      return result;
    }
  }

  /**
   * 删除账号时清理云端数据
   */
  static async deleteAccount(browserId: string): Promise<boolean> {
    try {
      // 1. 删除本地配置
      await configStore.deleteBrowserAccount(browserId);

      // 2. 删除云端记录
      await CloudService.deletePermanentLinkByBrowser(browserId);

      return true;
    } catch (error) {
      console.error(`[账号同步] 删除账号失败: ${browserId}`, error);
      return false;
    }
  }

  /**
   * 批量对比云端账号信息并同步浏览器名称
   * 用于刷新列表时确保本地浏览器名称与云端一致
   */
  static async syncBrowserNamesFromCloud(browserIds: string[]): Promise<{
    total: number;
    updated: number;
    skipped: number;
    failed: number;
  }> {
    const result = {
      total: browserIds.length,
      updated: 0,
      skipped: 0,
      failed: 0
    };

    if (browserIds.length === 0) {
      return result;
    }

    try {
      // 1. 批量获取云端状态（包含账号信息）
      const cloudData = await CloudService.batchCheckStatus(browserIds);

      if (!cloudData) {
        console.error('[批量同步名称] 获取云端状态失败');
        result.failed = browserIds.length;
        return result;
      }

      // 2. 获取本地浏览器列表
      const localBrowsersResponse = await invoke<any>('get_browser_list', {
        page: 0,
        pageSize: 1000
      });

      if (!localBrowsersResponse.success || !localBrowsersResponse.data?.list) {
        console.error('[批量同步名称] 获取本地浏览器列表失败');
        result.failed = browserIds.length;
        return result;
      }

      const localBrowsers = localBrowsersResponse.data.list;

      // 3. 逐个对比并更新
      for (const browserId of browserIds) {
        try {
          const cloudStatus = cloudData.accounts[browserId];
          const localBrowser = localBrowsers.find((b: any) => b.id === browserId);

          // 无云端信息或本地浏览器不存在 → 跳过
          if (!cloudStatus?.accountInfo?.nickname || !localBrowser) {
            result.skipped++;
            continue;
          }

          const cloudNickname = cloudStatus.accountInfo.nickname;
          const localName = localBrowser.name;

          // 名称一致 → 跳过
          if (cloudNickname === localName) {
            result.skipped++;
            continue;
          }

          // 名称不一致 → 更新 - 应用限流器
          await apiLimiter.runInternal(() =>
            invoke('update_browser_name', {
              browserId,
              name: cloudNickname
            })
          );

          console.log(`[批量同步名称] ✅ ${browserId}: "${localName}" → "${cloudNickname}"`);
          result.updated++;

        } catch (error) {
          console.error(`[批量同步名称] 更新 ${browserId} 失败:`, error);
          result.failed++;
        }
      }

      // 4. 如果有更新，重新加载浏览器列表到 browserStore
      if (result.updated > 0) {
        try {
          // 重新获取最新的浏览器列表
          const updatedResponse = await invoke<any>('get_browser_list', {
            page: 0,
            pageSize: 1000
          });

          if (updatedResponse.success && updatedResponse.data?.list) {
            // 更新 browserStore
            const { useBrowserStore } = await import('@/store/modules/browser');
            const browserStore = useBrowserStore();
            browserStore.setBrowsers(updatedResponse.data.list);
            console.log(`[批量同步名称] ✅ 已刷新 browserStore，更新了 ${result.updated} 个名称`);
          }
        } catch (error) {
          console.error('[批量同步名称] 刷新 browserStore 失败:', error);
        }

        // 显示结果通知
        notification.success(
          `已同步 ${result.updated} 个浏览器名称`,
          {
            title: '批量同步完成',
            duration: 3000
          }
        );
      }

      return result;

    } catch (error) {
      console.error('[批量同步名称] 执行失败:', error);
      result.failed = browserIds.length;
      return result;
    }
  }
}
