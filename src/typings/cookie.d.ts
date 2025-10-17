/**
 * Cookie和账号信息相关类型定义
 * 注意：Cookie不再存储在本地，改为从BitBrowser实时读取
 */
declare namespace Cookie {
  /** Cookie基本结构（从BitBrowser读取） */
  interface Cookie {
    /** Cookie名称 */
    name: string;
    /** Cookie值 */
    value: string;
    /** 域名 */
    domain: string;
    /** 路径 */
    path?: string;
    /** 过期时间（Unix时间戳，秒） */
    expires?: number;
    /** 是否HttpOnly */
    httpOnly?: boolean;
    /** 是否Secure */
    secure?: boolean;
    /** SameSite属性 */
    sameSite?: 'Strict' | 'Lax' | 'None';
  }

  /**
   * 账号数据（简化版，只存储不变的基本信息）
   *
   * 设计原则：
   * - ✅ 只缓存不常变动的基本信息：nickname, avatar, finderUsername 等
   * - ❌ 不缓存动态状态，实时从云端获取：loginMethod, cookieStatus 等
   */
  interface AccountData {
    /** 浏览器ID（必须，用于关联云端账号） */
    browserId: string;
    /** 账号信息（基本信息，不常变动） */
    accountInfo: AccountInfo;
    /** 更新时间 */
    updatedAt: string;

    // ✅ 以下动态数据不再本地缓存，实时从云端 Realtime 获取：
    // - loginMethod: 从 AccountMonitorService.getAccountStatus().accountInfo.loginMethod 获取
    // - cookieStatus: 从 Realtime 推送获取
    // - loginTime: 从云端获取
    // - lastSyncTime: 从云端获取
  }

  /** 云端账号数据（包含拆分的Cookie字段） */
  interface CloudAccountData {
    /** 浏览器ID */
    browser_id: string;
    /** 登录方式 */
    login_method: 'channels_helper' | 'shop_helper';
    /** Cookie状态 */
    cookie_status: 'pending' | 'online' | 'offline';

    // 视频号Cookie字段
    /** 视频号sessionid */
    channels_sessionid?: string;
    /** 视频号wxuin */
    channels_wxuin?: string;
    /** 视频号Cookie来源 */
    channels_cookie_source?: 'login' | 'plugin_auto';
    /** 视频号Cookie更新时间 */
    channels_cookie_updated_at?: string;

    // 小店助手Cookie字段
    /** 小店助手talent_token */
    shop_talent_token?: string;
    /** 小店助手talent_rand */
    shop_talent_rand?: string;
    /** 小店助手talent_magic */
    shop_talent_magic?: string;
    /** 小店助手Cookie更新时间 */
    shop_cookie_updated_at?: string;

    // 账号信息
    /** 昵称 */
    nickname?: string;
    /** 头像 */
    avatar?: string;
    /** 微信ID */
    wechat_id?: string;
    /** 视频号用户名 */
    finder_username?: string;
    /** 商家ID */
    appuin?: string;
    /** 店铺名称 */
    shop_name?: string;
    /** 账号信息JSON */
    account_info?: string;

    // 状态字段
    /** 最后检测时间 */
    last_check_time?: string;
    /** 最后有效时间 */
    last_valid_time?: string;
    /** Cookie更新时间 */
    cookie_updated_at?: string;
    /** Cookie过期时间 */
    cookie_expired_at?: string;
    /** 连续检测失败次数 */
    check_error_count?: number;

    // 其他字段
    /** 所有者 */
    owner?: string;
    /** 登录方式 */
    login_way?: string;
    /** 状态 */
    status?: string;
    /** 配置 */
    config?: string;
    /** 备注 */
    remark?: string;
    /** 创建时间 */
    created_at?: string;
    /** 更新时间 */
    updated_at?: string;
  }

  /** 云端Cookie状态缓存 */
  interface CloudStatusCache {
    /** Cookie状态 */
    cookieStatus: 'pending' | 'online' | 'offline' | 'checking';
    /** 最后检测时间 */
    lastCheckTime: string | null;
    /** 最后有效时间 */
    lastValidTime: string | null;
    /** Cookie获取时间 */
    cookieUpdatedAt: string | null;
    /** Cookie失效时间 */
    cookieExpiredAt: string | null;
    /** 连续检测失败次数 */
    checkErrorCount: number;
    /** 本地缓存时间 */
    cachedAt: number;
    /** 账号信息 */
    accountInfo?: {
      nickname: string;
      avatar: string;
      loginMethod: string;
    } | null;
    /** 视频号跳转链接缓存（与视频号Cookie绑定，Cookie失效时一起清空） */
    channelsJumpUrl?: string | null;
  }

  /** 账号信息 */
  interface AccountInfo {
    /** 昵称 */
    nickname: string;
    /** 头像URL */
    avatar: string;
    /** 微信ID（视频号助手） */
    wechatId?: string;
    /** 视频号用户名 */
    finderUsername?: string;
    /** 商家ID（小店带货助手） */
    appuin?: string;
  }

  /** Cookie状态 */
  type CookieStatus = 'pending' | 'online' | 'offline' | 'checking';

  /** 账号映射表（browser_id -> AccountData） */
  type AccountMap = Record<string, AccountData>;

  /**
   * @deprecated 使用 AccountData 代替
   * 为了兼容性保留，但不再使用
   */
  interface CookieData extends AccountData {
    cookies?: Cookie[];
    expiresTime?: string;
    renewalCount?: number;
    expireTime?: number;
    lastCheckTime?: number;
  }

  /**
   * @deprecated 使用 AccountMap 代替
   */
  type CookieMap = Record<string, CookieData>;

  /** Cookie检测结果 */
  interface CookieCheckResult {
    /** 是否有效 */
    isValid: boolean;
    /** 昵称 */
    nickname?: string;
    /** 消息 */
    message: string;
    /** 账号信息 */
    accountInfo?: AccountInfo;
  }

  /** Cookie验证响应 */
  interface VerifyCookieResponse {
    success: boolean;
    data: CookieCheckResult;
    message: string;
  }

  /** 在线时长信息 */
  interface OnlineDuration {
    /** 总在线秒数 */
    totalSeconds: number;
    /** 格式化字符串 */
    formatted: string;
    /** 是否已掉线 */
    isOffline: boolean;
  }
}
