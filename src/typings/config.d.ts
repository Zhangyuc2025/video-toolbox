/**
 * 配置相关类型定义
 */
declare namespace Config {
  /** 应用基础配置 */
  interface AppConfig {
    /** 比特浏览器路径 */
    bitbrowserPath: string;
    /** 比特浏览器API地址 */
    bitbrowserApi: string;
    /** 用户名 */
    username: string;
    /** 只看我的账号 */
    filterMyAccounts: boolean;
    /** 会员模式 */
    memberMode: boolean;
  }

  /** Cookie保活配置 */
  interface KeepAliveConfig {
    /** 是否启用保活 */
    enabled: boolean;
    /** 检测间隔（分钟） */
    checkInterval: number;
    /** 最大并发数 */
    maxConcurrent: number;
    /** 失败是否重试 */
    retryOnError: boolean;
    /** 重试间隔（分钟） */
    retryInterval: number;
    /** 失效时桌面通知 */
    notifyOnExpire: boolean;
  }

  /** 界面配置 */
  interface UIConfig {
    /** 主题模式 */
    themeMode: 'light' | 'dark' | 'auto';
    /** 主题色 */
    themeColor: string;
    /** 卡片密度 */
    cardDensity: 'compact' | 'standard' | 'comfortable';
    /** 动画效果 */
    enableAnimation: boolean;
  }

  /** 通知配置 */
  interface NotificationConfig {
    /** Cookie失效通知 */
    cookieExpired: boolean;
    /** 检测错误通知 */
    checkError: boolean;
    /** 批量操作完成通知 */
    batchComplete: boolean;
  }

  /** 完整配置 */
  interface FullConfig {
    /** 基础配置 */
    app: AppConfig;
    /** 保活配置 */
    keepAlive: KeepAliveConfig;
    /** 界面配置 */
    ui: UIConfig;
    /** 通知配置 */
    notification: NotificationConfig;
  }

  /** 配置存储键 */
  type ConfigKey =
    | 'bitbrowser_path'
    | 'bitbrowser_api'
    | 'username'
    | 'filter_my_accounts'
    | 'member_mode'
    | 'keep_alive_enabled'
    | 'keep_alive_interval'
    | 'keep_alive_concurrent'
    | 'theme_mode'
    | 'theme_color'
    | 'browser_cookies'
    | 'proxies';
}
