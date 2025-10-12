/**
 * 账号相关类型定义
 */

/**
 * 登录方式类型
 */
export enum LoginMethod {
  CHANNELS_HELPER = 'channels_helper',     // 视频号助手（不支持长按扫码）
  SHOP_HELPER = 'shop_helper',             // 微信小店带货助手（支持长按扫码）
}

/**
 * 上号方式
 */
export type LoginWay = 'qr_code' | 'permanent_link';

/**
 * 账号配置
 */
export interface AccountConfig {
  /** 登录方式 */
  loginMethod: LoginMethod;

  /** 上号方式：扫码上号 | 链接上号 */
  loginWay?: LoginWay;

  /** 代理配置 */
  proxy?: ProxyConfig;

  /** 分组ID */
  groupId?: string;

  /** 分组名称 */
  groupName?: string;

  /** 备注 */
  remark?: string;
}

/**
 * 代理配置
 */
export interface ProxyConfig {
  type: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  location?: string;
  remark?: string;
}

/**
 * 账号创建状态
 */
export enum AccountCreateState {
  CONFIG = 'config',         // 配置中
  QR_READY = 'qr_ready',     // 二维码已生成
  WAITING_SCAN = 'waiting_scan', // 等待扫码
  SCANNED = 'scanned',       // 已扫码
  VERIFYING = 'verifying',   // 验证中
  CREATING = 'creating',     // 创建中
  SUCCESS = 'success',       // 成功
  FAILED = 'failed',         // 失败
}

/**
 * 账号创建项
 */
export interface AccountCreateItem {
  /** 索引 */
  index: number;

  /** 配置 */
  config: AccountConfig;

  /** 状态 */
  state: AccountCreateState;

  /** 二维码URL */
  qrUrl?: string;

  /** 二维码过期时间 */
  qrExpireTime?: number;

  /** 永久链接（链接上号使用） */
  permanentLink?: string;

  /** 永久链接的二维码（链接上号使用） */
  linkQrCode?: string;

  /** 微信二维码token（扫码上号使用，用于轮询） */
  wechatToken?: string;

  /** 永久链接状态（链接上号使用） */
  linkStatus?: 'waiting' | 'scanned' | 'synced' | 'expired';

  /** Cookie */
  cookie?: string;

  /** 账号信息 */
  accountInfo?: {
    nickname?: string;
    avatar?: string;
  };

  /** 浏览器ID */
  browserId?: string;

  /** 是否为虚拟ID（扫码上号使用） */
  isVirtual?: boolean;

  /** 错误信息 */
  errorMsg?: string;

  /** 进度百分比 */
  progress: number;
}

/**
 * 二维码登录结果（从 Tauri 返回）
 */
export interface QRLoginResult {
  success: boolean;
  scanned: boolean;
  expired: boolean;
  token: string;           // 微信二维码token（用于轮询）
  qrUrl: string;           // 二维码URL
  expireTime: number;      // 过期时间（秒）
  cookies?: any[];         // Cookie数组（登录成功后返回）
  cookie?: string;         // Cookie字符串
  nickname?: string;
  avatar?: string;
  message?: string;
}

/**
 * 创建浏览器结果
 */
export interface CreateBrowserResult {
  success: boolean;
  browserId?: string;
  message?: string;
}
