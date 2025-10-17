/**
 * 统一推送数据处理器
 *
 * 职责：
 * 1. 标准化推送数据格式（云端 → 本地缓存格式）
 * 2. 更新本地缓存（单一数据源）
 * 3. 自动执行副作用（Cookie同步、名称更新、浏览器关闭等）
 * 4. 提供类型安全的数据访问
 *
 * 设计原则：
 * - 云端推送全量数据，前端直接使用
 * - 优先使用 accountInfo 完整对象
 * - 副作用异步执行，不阻塞缓存更新
 * - 防抖通知，避免通知轰炸
 */

import { invoke } from '@tauri-apps/api/tauri';
import type { CloudPushData, PushProcessResult } from '@/types/push';
import type { Cookie } from '@/typings/cookie';
import { apiLimiter } from '@/utils/api-limiter';
import { AccountSyncService } from './account-sync';
import { useBrowserStore } from '@/store/modules/browser';

/**
 * 标准化Cookie状态
 */
function normalizeCookieStatus(status: any): 'pending' | 'online' | 'offline' | 'checking' {
  if (!status) return 'pending';
  const normalized = String(status).toLowerCase();
  switch (normalized) {
    case 'online':
      return 'online';
    case 'offline':
      return 'offline';
    case 'checking':
      return 'checking';
    default:
      return 'pending';
  }
}

/**
 * 统一推送数据处理器
 */
export class PushDataHandler {
  /**
   * 处理推送数据更新
   *
   * @param data 云端推送的数据
   * @param cache 当前缓存引用
   * @param expiredBuffer 失效账号缓冲区（用于防抖通知）
   * @returns 处理结果（包含更新后的缓存状态）
   */
  static async processUpdate(
    data: CloudPushData,
    cache: Record<string, Cookie.CloudStatusCache>,
    expiredBuffer: string[]
  ): Promise<PushProcessResult> {
    if (!data.browserId) {
      return {
        success: false,
        cached: {} as Cookie.CloudStatusCache,
        error: '缺少 browserId'
      };
    }

    const { browserId } = data;
    const oldCache = cache[browserId];

    try {
      // 1. 标准化数据格式
      const normalized = this.normalizeData(data, oldCache);

      // 2. 执行副作用（不阻塞缓存更新）
      const sideEffects = await this.executeSideEffects(data, normalized, oldCache, expiredBuffer);

      return {
        success: true,
        cached: normalized,
        sideEffects
      };
    } catch (error) {
      console.error(`[推送处理] 处理失败: ${browserId}`, error);
      return {
        success: false,
        cached: oldCache || {} as Cookie.CloudStatusCache,
        error: error instanceof Error ? error.message : '处理失败'
      };
    }
  }

  /**
   * 标准化推送数据为缓存格式
   *
   * 核心原则：
   * - 优先使用云端推送的完整字段
   * - Fallback 到旧缓存
   * - 优先使用 accountInfo 对象而不是单独字段
   */
  private static normalizeData(
    data: CloudPushData,
    oldCache?: Cookie.CloudStatusCache
  ): Cookie.CloudStatusCache {
    const now = Date.now();
    const normalizedStatus = normalizeCookieStatus(data.cookieStatus);

    // ✅ 构建 accountInfo（优先使用 data.accountInfo）
    let accountInfo = data.accountInfo;
    if (!accountInfo && data.nickname) {
      // Fallback: 从单独字段构建（向后兼容）
      accountInfo = {
        nickname: data.nickname,
        avatar: data.avatar || '',
        loginMethod: (data.loginMethod as any) || 'channels_helper'
      };
    }

    return {
      // 状态字段
      cookieStatus: normalizedStatus,

      // 时间戳（优先使用云端推送的值）
      lastCheckTime: data.lastCheckTime || new Date().toISOString(),
      lastValidTime: data.lastValidTime ||
        (normalizedStatus === 'online' ? new Date().toISOString() : oldCache?.lastValidTime),
      cookieUpdatedAt: data.cookieUpdatedAt || oldCache?.cookieUpdatedAt,
      cookieExpiredAt: data.cookieExpiredAt,

      // 错误计数
      checkErrorCount: data.checkErrorCount ?? oldCache?.checkErrorCount ?? 0,

      // ✅ 跳转链接缓存（带货助手账号专用）
      channelsJumpUrl: data.channelsJumpUrl || oldCache?.channelsJumpUrl || null,

      // 缓存时间
      cachedAt: now,

      // 账号信息（优先使用新推送的，fallback 到旧缓存）
      accountInfo: accountInfo || oldCache?.accountInfo
    };
  }

  /**
   * 执行副作用
   *
   * 副作用类型：
   * 1. 更新浏览器名称（nickname变化时）
   * 2. 恢复Cookie（offline → online时）
   * 3. 关闭浏览器（online → offline时）
   * 4. 添加到通知队列（online → offline时）
   */
  private static async executeSideEffects(
    data: CloudPushData,
    normalized: Cookie.CloudStatusCache,
    oldCache: Cookie.CloudStatusCache | undefined,
    expiredBuffer: string[]
  ): Promise<PushProcessResult['sideEffects']> {
    const { browserId } = data;
    const oldStatus = oldCache?.cookieStatus;
    const oldNickname = oldCache?.accountInfo?.nickname;
    const newNickname = normalized.accountInfo?.nickname;

    const sideEffects: PushProcessResult['sideEffects'] = {};

    // 副作用1: 更新浏览器名称
    if (newNickname && newNickname !== oldNickname) {
      try {
        await apiLimiter.runInternal(() =>
          invoke('update_browser_name', {
            browserId,
            name: newNickname
          })
        );
        console.log(`[推送处理] ✅ 浏览器名称已更新: ${browserId} -> ${newNickname}`);
        sideEffects.nameUpdated = true;
      } catch (error) {
        console.error(`[推送处理] 更新浏览器名称失败: ${browserId}`, error);
        sideEffects.nameUpdated = false;
      }
    }

    // 副作用2: 状态恢复（offline/pending → online）
    if (normalized.cookieStatus === 'online' && oldStatus !== 'online') {
      console.log(`[推送处理] 检测到账号恢复: ${newNickname || browserId} (${oldStatus} → online)`);

      // 使用 AccountSyncService 统一处理 Cookie 同步（不强制，让其自行判断）
      AccountSyncService.syncSingle(browserId, false).catch(err => {
        console.error(`[推送处理] Cookie恢复同步失败: ${browserId}`, err);
      });

      sideEffects.accountRecovered = true;
    }

    // 副作用3: 状态掉线（online → offline）
    if (normalized.cookieStatus === 'offline' && oldStatus === 'online') {
      const nickname = newNickname || browserId;
      console.log(`[推送处理] 检测到账号掉线: ${nickname} (${browserId})`);

      // 3.1 自动关闭浏览器
      try {
        await invoke('close_browser', { browserId });
        console.log(`[推送处理] ✅ 已自动关闭浏览器: ${nickname}`);

        // 更新浏览器运行状态
        const browserStore = useBrowserStore();
        browserStore.updateBrowserRunningStatus(browserId, false);

        sideEffects.browserClosed = true;
      } catch (error) {
        console.error(`[推送处理] 自动关闭浏览器失败: ${nickname}`, error);
        sideEffects.browserClosed = false;
      }

      // 3.2 添加到通知缓冲区（由调用方统一发送，防抖）
      if (!expiredBuffer.includes(nickname)) {
        expiredBuffer.push(nickname);
      }
    }

    return sideEffects;
  }
}
