/**
 * 浏览器管理相关类型定义
 */

/** 浏览器信息 */
export interface Browser {
  /** 浏览器ID */
  id: string;
  /** 账号昵称 */
  name: string;
  /** 备注 */
  remark?: string;
  /** 序号 */
  seq: number;
  /** 分组ID */
  groupId?: string;
  /** 分组名称 */
  groupName?: string;
  /** 创建者用户名 */
  createdName?: string;
  /** 代理类型 */
  proxyType?: 'noproxy' | 'socks5' | 'http';
  /** 代理主机 */
  host?: string;
  /** 代理端口 */
  port?: string;
  /** 代理用户名 */
  proxyUserName?: string;
  /** 代理密码 */
  proxyPassword?: string;
  /** Cookie数据 */
  cookie?: Cookie[];
}

/** Cookie数据结构 */
export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/** Cookie状态 */
export interface CookieStatus {
  /** 是否有效 */
  isValid: boolean;
  /** 昵称 */
  nickname?: string;
  /** 过期时间 */
  expiresTime?: string;
  /** 续期次数 */
  renewalCount?: number;
  /** 最后检测时间 */
  lastCheckTime?: number;
}

/** 账号信息（来自视频号API） */
export interface AccountInfo {
  /** 昵称 */
  nickname: string;
  /** 头像URL */
  headImgUrl: string;
  /** 账号状态 0=正常, 1=有限制 */
  accountState: 0 | 1;
  /** 状态详情 */
  stateDetail?: StateDetail[];
  /** 违规历史 */
  violationHistory?: ViolationRecord[];
  /** 被处罚视频 */
  punishedFeeds?: PunishedFeed[];
}

/** 状态详情 */
export interface StateDetail {
  title: string;
  desc: string;
  detail?: string;
  acctStateKeyId: number;
}

/** 违规记录 */
export interface ViolationRecord {
  title: string;
  content: string;
  url: string;
  timestamp: number;
}

/** 被处罚视频 */
export interface PunishedFeed {
  title: string;
  imgUrl: string;
  publishTime: string;
  punishState: string;
  punishDetailUrl: string;
  publishUnixTimestamp: string;
}

/** 分组信息 */
export interface BrowserGroup {
  id: string;
  name: string;
  count: number;
}

/** 代理配置 */
export interface ProxyConfig {
  type: 'socks5' | 'http';
  host: string;
  port: string;
  username?: string;
  password?: string;
}

/** 浏览器启动选项 */
export interface LaunchOptions {
  /** 启动参数 */
  args?: string[];
  /** 加载URL */
  loadUrl?: string;
  /** 是否清除Cookie */
  clearCookies?: boolean;
}

/** API响应结构 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

/** 浏览器列表响应 */
export interface BrowserListResponse {
  list: Browser[];
  total: number;
}

/** 打开浏览器响应 */
export interface OpenBrowserResponse {
  http: string;
  ws: string;
}

/** 进程状态事件 */
export interface ProcessStatusEvent {
  runningBrowsers: string[];
  timestamp: number;
}

/** Cookie检测事件 */
export interface CookieCheckEvent {
  browserId: string;
  isValid: boolean;
  nickname?: string;
  expiresTime?: string;
  accountInfo?: AccountInfo;
}
