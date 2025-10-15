/**
 * 云端推送数据完整类型定义
 * 与云端 push-helper.ts 保持一致
 *
 * 云端推送策略：全量推送（每次推送包含所有字段）
 * 前端策略：直接使用，无需增量合并
 */

/**
 * Cookie数据格式
 */
export interface CookieData {
  name: string;
  value: string;
  domain: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
}

/**
 * 账号信息（完整格式）
 */
export interface AccountInfo {
  nickname: string;
  avatar: string;
  loginMethod: 'channels_helper' | 'shop_helper';
  finderUsername?: string;  // 视频号ID
  wechatId?: string;        // 微信号
  appuin?: string;          // 视频号助手 appuin
  shopName?: string;        // 小店名称
}

/**
 * Cookie状态类型
 */
export type CookieStatus = 'pending' | 'online' | 'offline' | 'checking';

/**
 * 云端推送数据完整类型定义
 *
 * 注意：所有字段都是可选的，因为推送可能只包含部分更新
 * 但在实际使用中，云端会推送全量数据
 */
export interface CloudPushData {
  browserId: string;

  // ===== 状态字段 =====
  cookieStatus?: CookieStatus;
  scanned?: boolean;       // 二维码已扫码
  confirmed?: boolean;     // 二维码已确认
  expired?: boolean;       // 二维码已过期

  // ===== Cookie数据 =====
  cookies?: CookieData[];

  // ===== 时间戳（ISO字符串，云端已自动转换）=====
  lastCheckTime?: string;      // 最后检测时间
  lastValidTime?: string;      // 最后有效时间
  cookieUpdatedAt?: string;    // Cookie更新时间（扫码登录时间）
  cookieExpiredAt?: string;    // Cookie失效时间
  shopToChannelsUpdatedAt?: number; // 跨平台Cookie更新时间（Unix秒）

  // ===== 错误计数 =====
  checkErrorCount?: number;

  // ===== 账号信息 =====
  /**
   * 完整的账号信息对象（推荐使用）
   * 云端会推送完整的 accountInfo，包含所有字段
   */
  accountInfo?: AccountInfo;

  /**
   * 向后兼容：单独的账号字段
   * 如果 accountInfo 不存在，可以从这些字段构建
   */
  nickname?: string;
  avatar?: string;
  loginMethod?: string;

  // ===== 变更前的数据（用于对比）=====
  oldData?: {
    cookieStatus?: string;
    nickname?: string;
  };
}

/**
 * 推送数据处理结果
 */
export interface PushProcessResult {
  success: boolean;
  cached: Cookie.CloudStatusCache;
  sideEffects?: {
    nameUpdated?: boolean;
    cookieSynced?: boolean;
    browserClosed?: boolean;
    accountRecovered?: boolean;
  };
  error?: string;
}
