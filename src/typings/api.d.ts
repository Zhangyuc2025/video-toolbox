/**
 * Namespace Api
 *
 * All backend api type
 */
declare namespace Api {
  namespace Common {
    /** common params of paginating */
    interface PaginatingCommonParams {
      /** current page number */
      current: number;
      /** page size */
      size: number;
      /** total count */
      total: number;
    }

    /** common params of paginating query list data */
    interface PaginatingQueryRecord<T = any> extends PaginatingCommonParams {
      records: T[];
    }

    /** common search params of table */
    type CommonSearchParams = Pick<Common.PaginatingCommonParams, 'current' | 'size'>;

    /**
     * enable status
     *
     * - "1": enabled
     * - "2": disabled
     */
    type EnableStatus = '1' | '2';

    /** common record */
    type CommonRecord<T = any> = {
      /** record id */
      id: number;
      /** record creator */
      createBy: string;
      /** record create time */
      createTime: string;
      /** record updater */
      updateBy: string;
      /** record update time */
      updateTime: string;
      /** record status */
      status: EnableStatus | null;
    } & T;
  }

  /**
   * namespace Auth
   *
   * backend api module: "auth"
   */
  namespace Auth {
    interface LoginToken {
      token: string;
      refreshToken: string;
    }

    interface UserInfo {
      userId: string;
      userName: string;
      roles: string[];
      buttons: string[];
    }
  }

  /**
   * namespace Route
   *
   * backend api module: "route"
   */
  namespace Route {
    type ElegantConstRoute = import('@elegant-router/types').ElegantConstRoute;

    interface MenuRoute extends ElegantConstRoute {
      id: string;
    }

    interface UserRoute {
      routes: MenuRoute[];
      home: import('@elegant-router/types').LastLevelRouteKey;
    }
  }

  /**
   * namespace WeChat
   *
   * backend api module: "wechat"
   */
  namespace WeChat {
    /** 获取二维码请求参数 */
    interface GetQrCodeParams {
      proxyConfig?: Proxy.ProxyConfig;
    }

    /** 获取二维码响应 */
    interface GetQrCodeResponse {
      success: boolean;
      data?: {
        /** Base64编码的二维码图片 */
        qrImage: string;
        /** 登录Token */
        token: string;
      };
      message: string;
    }

    /** 检查扫码状态请求参数 */
    interface CheckScanStatusParams {
      /** 登录Token */
      token: string;
      /** 代理配置 */
      proxyConfig?: Proxy.ProxyConfig;
    }

    /** 扫码状态 */
    type ScanStatus = 'waiting' | 'scanned' | 'success' | 'expired' | 'error';

    /** 检查扫码状态响应 */
    interface CheckScanStatusResponse {
      success: boolean;
      data?: {
        /** 状态码 */
        status: ScanStatus;
        /** Cookie列表 */
        cookies?: Cookie.Cookie[];
      };
      message: string;
    }

    /** 验证Cookie请求参数 */
    interface VerifyCookieParams {
      /** Cookie列表 */
      cookies: Cookie.Cookie[];
      /** 代理配置 */
      proxyConfig?: Proxy.ProxyConfig;
      /** 是否跳过首页请求 */
      skipHomePage?: boolean;
      /** 是否轻量级模式（仅验证，不获取完整信息） */
      lightweight?: boolean;
    }

    /** 验证Cookie响应 */
    interface VerifyCookieResponse {
      success: boolean;
      data?: {
        /** 是否有效 */
        isValid: boolean;
        /** 账号信息 */
        accountInfo?: Cookie.AccountInfo;
        /** 过期时间 */
        expiresTime?: string;
      };
      message: string;
    }
  }

  /**
   * namespace BitBrowser
   *
   * backend api module: "bitbrowser"
   */
  namespace BitBrowser {
    /** 通用API响应 */
    interface ApiResponse<T = any> {
      success: boolean;
      data?: T;
      message: string;
    }

    /** 同步Cookie请求参数 */
    interface SyncCookiesParams {
      /** 浏览器ID */
      browserId: string;
      /** Cookie列表 */
      cookies: Cookie.Cookie[];
    }
  }
}
