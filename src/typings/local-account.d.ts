/**
 * 本地账号数据类型定义（云端化后精简版）
 *
 * 设计原则：
 * - 本地只存储必要的元数据
 * - Cookie和状态从云端实时获取
 * - 保留基本信息用于快速显示
 */
declare namespace LocalAccount {
  /**
   * 本地账号数据（精简版）
   * 只存储必要的元数据，其他从云端获取
   */
  interface AccountData {
    /** 浏览器ID（必须，用于关联云端账号） */
    browserId: string;

    /** 基本账号信息（可选，用于快速显示，避免频繁请求云端） */
    accountInfo?: {
      nickname: string;
      avatar: string;
      wechatId?: string;
      finderUsername?: string;
      appuin?: string;
    };

    /** 登录方式（可选，也可从云端获取） */
    loginMethod?: 'channels_helper' | 'shop_helper';

    /** 本地登录时间（可选，用于本地排序） */
    loginTime?: number;

    /** 最后更新时间（可选，用于判断是否需要刷新） */
    lastSyncTime?: number;
  }

  /** 账号映射表（browser_id -> AccountData） */
  type AccountMap = Record<string, AccountData>;

  /**
   * 扩展：云端状态缓存（可选）
   * 用于减少云端查询，定期刷新
   */
  interface CachedCloudStatus {
    /** Cookie状态 */
    cookieStatus: 'pending' | 'online' | 'offline';

    /** 最后检测时间 */
    lastCheckTime: string | null;

    /** Cookie获取时间 */
    cookieUpdatedAt: string | null;

    /** Cookie失效时间 */
    cookieExpiredAt: string | null;

    /** 缓存时间（本地） */
    cachedAt: number;
  }

  /** 账号数据 + 云端状态缓存 */
  interface AccountWithStatus extends AccountData {
    cloudStatus?: CachedCloudStatus;
  }
}
