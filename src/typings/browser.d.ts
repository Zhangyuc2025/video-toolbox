/**
 * 浏览器相关类型定义
 */
declare namespace Browser {
  /** 浏览器基本信息 */
  interface BrowserInfo {
    /** 浏览器ID */
    id: string;
    /** 浏览器名称 */
    name: string;
    /** 备注 */
    remark?: string;
    /** 代理类型 */
    proxyType?: ProxyType;
    /** 代理主机 */
    host?: string;
    /** 代理端口 */
    port?: string;
    /** 代理用户名 */
    proxyUserName?: string;
    /** 代理密码 */
    proxyPassword?: string;
    /** 创建者 */
    createdName?: string;
    /** 创建时间 */
    createTime?: string;
    /** 启动URL */
    openUrl?: string;
    /** 指纹配置 */
    fingerprint?: Record<string, any>;
    /** 是否正在运行 */
    isRunning?: boolean;
  }

  /** 代理类型 */
  type ProxyType = 'http' | 'https' | 'socks5' | 'noproxy';

  /** 浏览器状态 */
  type BrowserStatus = 'running' | 'stopped' | 'error';

  /** 浏览器列表响应 */
  interface BrowserListResponse {
    success: boolean;
    data: BrowserInfo[];
    message: string;
  }

  /** 浏览器操作响应 */
  interface BrowserOperationResponse {
    success: boolean;
    data?: {
      id?: string;
      ws?: {
        selenium?: string;
        puppeteer?: string;
      };
      http?: string;
      webdriver?: string;
    };
    message: string;
  }

  /** 创建浏览器参数 */
  interface CreateBrowserParams {
    /** 浏览器名称 */
    name: string;
    /** 备注 */
    remark?: string;
    /** 代理配置 */
    proxyConfig?: Proxy.ProxyConfig;
    /** 启动URL */
    openUrl?: string;
  }

  /** 更新浏览器参数 */
  interface UpdateBrowserParams {
    /** 浏览器ID */
    id: string;
    /** 浏览器名称 */
    name?: string;
    /** 备注 */
    remark?: string;
    /** 代理配置 */
    proxyConfig?: Proxy.ProxyConfig;
    /** Cookie列表 */
    cookies?: Cookie.Cookie[];
  }
}
