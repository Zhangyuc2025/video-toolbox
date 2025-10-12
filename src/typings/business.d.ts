/**
 * 业务类型统一导出
 *
 * 包含所有业务相关的类型定义：
 * - Browser: 浏览器相关
 * - Cookie: Cookie相关
 * - Proxy: 代理相关
 * - Config: 配置相关
 */

/// <reference path="./browser.d.ts" />
/// <reference path="./cookie.d.ts" />
/// <reference path="./proxy.d.ts" />
/// <reference path="./config.d.ts" />

/** 全局业务类型命名空间 */
declare namespace Business {
  /** 重新导出浏览器类型 */
  export import Browser = Browser;

  /** 重新导出Cookie类型 */
  export import Cookie = Cookie;

  /** 重新导出代理类型 */
  export import Proxy = Proxy;

  /** 重新导出配置类型 */
  export import Config = Config;
}

/**
 * 使用示例：
 *
 * // 方式1：直接使用命名空间
 * const browser: Browser.BrowserInfo = { ... }
 * const cookie: Cookie.CookieData = { ... }
 *
 * // 方式2：通过Business命名空间
 * const browser: Business.Browser.BrowserInfo = { ... }
 *
 * // 方式3：在.vue文件中导入类型
 * import type { BrowserInfo } from '@/typings/browser'
 */
