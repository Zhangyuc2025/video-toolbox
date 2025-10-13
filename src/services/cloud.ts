/**
 * 云服务API - 永久链接功能
 */
import axios from 'axios';

// 云服务URL（已迁移到 Cloudflare Workers，使用自定义域名避免 DNS 污染）
const CLOUD_SERVICE_URL = import.meta.env.VITE_CLOUD_SERVICE_URL || 'https://api.quanyuge.cloud';

// 配置 axios 全局超时（30秒，适应微信API可能的延迟）
axios.defaults.timeout = 30000;

// API端点（已更新为动态路由格式）
const API_ENDPOINTS = {
  GENERATE_LINK: `${CLOUD_SERVICE_URL}/api/generate-link`,
  CHECK_STATUS: `${CLOUD_SERVICE_URL}/api/status?action=qr`,
  SYNC_COOKIE: `${CLOUD_SERVICE_URL}/api/sync-cookie`,
  REGISTER_BROWSER: `${CLOUD_SERVICE_URL}/api/browser?action=register`,
  AUTO_REGISTER_BROWSER: `${CLOUD_SERVICE_URL}/api/browser?action=auto`,
  CHECK_ACCOUNT_STATUS: `${CLOUD_SERVICE_URL}/api/status?action=account`,
  BATCH_CHECK_STATUS: `${CLOUD_SERVICE_URL}/api/status?action=batch`,
  INSTANT_VALIDATE: `${CLOUD_SERVICE_URL}/api/validate?action=instant`,
  DELETE_LINK: `${CLOUD_SERVICE_URL}/api/admin?action=delete-link`,
  DELETE_LINK_BY_BROWSER: `${CLOUD_SERVICE_URL}/api/admin?action=delete-by-browser`,
  CLEANUP_ORPHAN_LINKS: `${CLOUD_SERVICE_URL}/api/admin?action=cleanup-orphan`
};

/**
 * 生成永久链接结果
 */
export interface GenerateLinkResult {
  browserId: string;
  url: string;
  qrCode: string;  // 永久链接页面的二维码（链接上号用）
  loginQrUrl: string;  // 微信登录二维码URL（扫码上号用）
}

/**
 * 同步Cookie结果
 */
export interface SyncCookieResult {
  cookies: Array<{ name: string; value: string; domain: string }>;
  nickname: string;
  avatar: string;
  loginMethod?: string;
  updatedAt: string;
}

/**
 * 检查状态结果 (V2 简化版)
 */
export interface CheckStatusResult {
  success: boolean;
  scanned: boolean;        // 是否已扫码
  confirmed: boolean;      // 是否已确认登录
  expired: boolean;        // 是否已过期
  owner?: string;          // 拥有者（多用户隔离）
  nickname?: string;
  avatar?: string;
  loginMethod?: string;
  browserId?: string;
  cookies?: any[];
  message?: string;
}

/**
 * 账号Cookie状态
 */
export interface AccountCookieStatus {
  cookieStatus: 'pending' | 'online' | 'offline' | 'checking' | 'not_found';  // V2 新增 not_found 状态
  lastCheckTime: string | null;
  lastValidTime: string | null;
  cookieUpdatedAt: string | null;  // Cookie获取时间
  cookieExpiredAt: string | null;  // Cookie失效时间
  checkErrorCount: number;
  accountInfo: {
    nickname: string;
    avatar: string;
    loginMethod: string;
    wechatId?: string;
    finderUsername?: string;
    appuin?: string;
    shopName?: string;
  } | null;
}

/**
 * 批量查询结果
 */
export interface BatchCheckStatusResult {
  total: number;
  found: number;
  accounts: Record<string, AccountCookieStatus>;
}

/**
 * 云服务API类
 */
export class CloudService {
  /**
   * 生成永久登录链接
   */
  static async generatePermanentLink(browserId: string, loginMethod: string, config?: any): Promise<GenerateLinkResult> {
    try {
      console.log('[CloudService] 生成永久链接:', browserId, loginMethod);

      // 从 config 中提取 loginWay，默认为 permanent_link
      const loginWay = config?.loginWay || 'permanent_link';

      // 获取当前用户名（用于多用户隔离）
      const { configStore } = await import('@/utils/config-store');
      const owner = await configStore.getUsername();

      // 清理 config，移除 undefined 值，避免传递给后端导致错误
      const cleanConfig = config ? Object.fromEntries(
        Object.entries(config).filter(([_, v]) => v !== undefined)
      ) : undefined;

      const requestBody = {
        browserId,
        loginMethod,
        loginWay,
        config: cleanConfig,
        owner  // 拥有者（多用户隔离）
      };

      console.log('[CloudService] 请求体:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(API_ENDPOINTS.GENERATE_LINK, requestBody);

      if (!response.data.success) {
        throw new Error(response.data.error || '生成链接失败');
      }

      console.log('[CloudService] 链接生成成功:', response.data.data.browserId);
      return response.data.data;
    } catch (error: any) {
      console.error('[CloudService] 生成永久链接失败:', error);
      console.error('[CloudService] 错误详情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      // 打印完整的响应数据，便于调试
      if (error.response?.data) {
        console.error('[CloudService] 后端返回的错误:', JSON.stringify(error.response.data, null, 2));
      }

      throw new Error(error.response?.data?.error || error.response?.data?.message || error.message || '生成二维码失败');
    }
  }

  /**
   * 检查扫码状态
   * @param browserId 浏览器ID
   * @param signal AbortSignal，用于取消请求
   */
  static async checkLinkStatus(browserId: string, signal?: AbortSignal): Promise<CheckStatusResult> {
    try {
      const response = await axios.get(API_ENDPOINTS.CHECK_STATUS, {
        params: { browserId },
        signal  // ✅ 支持 AbortSignal
      });

      return response.data;
    } catch (error: any) {
      // 请求被取消，直接抛出让调用方处理
      if (axios.isCancel(error) || error.name === 'CanceledError') {
        throw error;
      }

      console.error('[CloudService] 检查扫码状态失败:', error);
      return {
        success: false,
        scanned: false,
        expired: false
      };
    }
  }

  /**
   * 从云端同步Cookie
   */
  static async syncCookieFromCloud(browserId: string): Promise<SyncCookieResult> {
    try {
      console.log('[CloudService] 同步Cookie:', browserId);

      // 获取当前用户名（用于多用户隔离）
      const { configStore } = await import('@/utils/config-store');
      const owner = await configStore.getUsername();

      const response = await axios.post(API_ENDPOINTS.SYNC_COOKIE, {
        browserId,
        owner  // ✅ 拥有者（多用户隔离）
      });

      if (!response.data.success) {
        throw new Error(response.data.error || '同步Cookie失败');
      }

      console.log('[CloudService] Cookie同步成功:', response.data.data.nickname);
      return response.data.data;
    } catch (error: any) {
      console.error('[CloudService] 同步Cookie失败:', error);
      throw new Error(error.response?.data?.error || error.message);
    }
  }

  /**
   * 获取云服务URL（用于显示给用户）
   */
  static getServiceUrl(): string {
    return CLOUD_SERVICE_URL;
  }

  /**
   * 获取完整的登录链接URL
   */
  static getLoginUrl(browserId: string): string {
    return `${CLOUD_SERVICE_URL}/login/${browserId}`;
  }

  /**
   * 删除永久链接
   */
  static async deletePermanentLink(browserId: string): Promise<boolean> {
    try {
      console.log('[CloudService] 删除永久链接:', browserId);

      // 获取当前用户名（用于多用户隔离）
      const { configStore } = await import('@/utils/config-store');
      const owner = await configStore.getUsername();

      console.log('[CloudService] 删除参数:', { browserId, owner });

      const response = await axios.delete(API_ENDPOINTS.DELETE_LINK, {
        params: { browserId, owner }
      });

      if (!response.data.success) {
        console.error('[CloudService] 删除链接失败:', {
          browserId,
          owner,
          error: response.data.error,
          status: response.status
        });
        return false;
      }

      console.log('[CloudService] 链接删除成功:', browserId);
      return true;
    } catch (error: any) {
      console.error('[CloudService] 删除永久链接失败:', {
        browserId,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      // 不抛出错误，返回 false，避免影响主流程
      return false;
    }
  }

  /**
   * 注册浏览器ID（绑定云端账号）
   */
  static async registerBrowser(
    browserId: string,
    cookies?: any[],
    loginMethod?: string,
    accountInfo?: any
  ): Promise<boolean> {
    try {
      console.log('[CloudService] 注册浏览器:', { browserId });

      // 获取当前用户名（用于多用户隔离）
      const { configStore } = await import('@/utils/config-store');
      const owner = await configStore.getUsername();

      const response = await axios.post(API_ENDPOINTS.REGISTER_BROWSER, {
        browserId,
        cookies,
        loginMethod,
        accountInfo,
        owner  // ✅ 拥有者（多用户隔离）
      });

      if (!response.data.success) {
        console.error('[CloudService] 注册浏览器失败:', response.data.error);
        return false;
      }

      console.log('[CloudService] 浏览器注册成功:', browserId);
      return true;
    } catch (error: any) {
      console.error('[CloudService] 注册浏览器失败:', error);
      return false;
    }
  }

  /**
   * 查询单个账号的Cookie状态
   */
  static async checkAccountStatus(browserId: string): Promise<AccountCookieStatus | null> {
    try {
      const response = await axios.get(API_ENDPOINTS.CHECK_ACCOUNT_STATUS, {
        params: { browserId }
      });

      if (!response.data.success) {
        return null;
      }

      return response.data.data;
    } catch (error: any) {
      console.error('[CloudService] 查询账号状态失败:', error);
      return null;
    }
  }

  /**
   * 批量查询账号Cookie状态
   */
  static async batchCheckStatus(browserIds: string[]): Promise<BatchCheckStatusResult | null> {
    try {
      console.log(`[CloudService] 批量查询 ${browserIds.length} 个账号状态`);

      const response = await axios.post(API_ENDPOINTS.BATCH_CHECK_STATUS, {
        browserIds
      });

      if (!response.data.success) {
        console.error('[CloudService] 批量查询失败:', response.data.error);
        return null;
      }

      return response.data.data;
    } catch (error: any) {
      console.error('[CloudService] 批量查询失败:', error);
      return null;
    }
  }

  /**
   * 原子化自动注册浏览器
   * 一次性完成：验证Cookie + 注册浏览器
   */
  static async autoRegisterBrowser(
    browserId: string,
    cookies: any[],
    loginMethod: string,
    accountInfo?: any
  ): Promise<{ browserId: string; cookieStatus: string; accountInfo: any } | null> {
    try {
      console.log('[CloudService] 原子化注册浏览器:', { browserId, loginMethod });

      // 获取当前用户名（用于多用户隔离）
      const { configStore } = await import('@/utils/config-store');
      const owner = await configStore.getUsername();

      const response = await axios.post(API_ENDPOINTS.AUTO_REGISTER_BROWSER, {
        browserId,
        cookies,
        loginMethod,
        accountInfo,
        owner  // ✅ 拥有者（多用户隔离）
      });

      if (!response.data.success) {
        console.error('[CloudService] 自动注册失败:', response.data.error);
        return null;
      }

      console.log('[CloudService] 自动注册成功:', browserId);
      return response.data.data;
    } catch (error: any) {
      console.error('[CloudService] 自动注册失败:', error);
      return null;
    }
  }

  /**
   * 通过浏览器ID删除永久链接
   * 用于删除浏览器时自动清理云端数据
   */
  static async deletePermanentLinkByBrowser(browserId: string): Promise<boolean> {
    try {
      console.log('[CloudService] 通过浏览器ID删除永久链接:', browserId);

      // 获取当前用户名（用于多用户隔离）
      const { configStore } = await import('@/utils/config-store');
      const owner = await configStore.getUsername();

      const response = await axios.delete(API_ENDPOINTS.DELETE_LINK_BY_BROWSER, {
        params: { browserId, owner }
      });

      if (!response.data.success) {
        console.error('[CloudService] 删除链接失败:', response.data.error);
        return false;
      }

      console.log('[CloudService] 链接删除成功:', browserId);
      return true;
    } catch (error: any) {
      console.error('[CloudService] 通过浏览器ID删除永久链接失败:', error);
      // 不抛出错误，返回 false，避免影响主流程
      return false;
    }
  }

  /**
   * 清理孤儿链接记录
   * 删除云端1天前创建但没有绑定浏览器的链接
   */
  static async cleanupOrphanLinks(): Promise<{ success: boolean; deletedCount: number }> {
    try {
      console.log('[CloudService] 清理云端孤儿记录（1天前创建且未绑定）');

      const response = await axios.delete(API_ENDPOINTS.CLEANUP_ORPHAN_LINKS);

      if (!response.data.success) {
        console.error('[CloudService] 清理孤儿记录失败:', response.data.error);
        return { success: false, deletedCount: 0 };
      }

      const deletedCount = response.data.data?.deletedCount || 0;
      console.log(`[CloudService] 孤儿记录清理成功: 删除了 ${deletedCount} 条记录`);
      return { success: true, deletedCount };
    } catch (error: any) {
      console.error('[CloudService] 清理孤儿记录失败:', error);
      // 不抛出错误，返回失败状态
      return { success: false, deletedCount: 0 };
    }
  }

  /**
   * 即时验证账号Cookie（调用GitHub Actions同款验证逻辑）
   * 在打开浏览器前调用，确保Cookie有效
   */
  static async instantValidateCookie(browserId: string): Promise<{
    valid: boolean;
    cookieStatus: string;
    nickname?: string;
    avatar?: string;
    error?: string;
  } | null> {
    try {
      console.log('[CloudService] 即时验证Cookie:', browserId);

      // 获取当前用户名（用于多用户隔离）
      const { configStore } = await import('@/utils/config-store');
      const owner = await configStore.getUsername();

      const response = await axios.post(API_ENDPOINTS.INSTANT_VALIDATE, {
        browserId,
        owner  // ✅ 拥有者（多用户隔离）
      });

      if (!response.data.success) {
        console.error('[CloudService] 验证失败:', response.data.error);
        return null;
      }

      const data = response.data.data;
      console.log(`[CloudService] 验证结果: ${data.valid ? '有效' : '失效'}`);

      return {
        valid: data.valid,
        cookieStatus: data.cookieStatus,
        nickname: data.nickname,
        avatar: data.avatar,
        error: data.error
      };
    } catch (error: any) {
      console.error('[CloudService] 即时验证失败:', error);
      return null;
    }
  }
}
