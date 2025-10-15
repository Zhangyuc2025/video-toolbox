/**
 * Cookie解析和组装工具
 * 负责Cookie数组与拆分字段之间的转换
 */

/**
 * 拆分后的Cookie字段
 */
export interface ParsedCookies {
  // 视频号Cookie
  channels_sessionid?: string;
  channels_wxuin?: string;

  // 小店助手Cookie
  shop_talent_token?: string;
  shop_talent_rand?: string;
  shop_talent_magic?: string;
}

/**
 * Cookie数组格式
 */
export interface CookieItem {
  name: string;
  value: string;
  domain?: string;
}

/**
 * 云端账号数据（包含拆分字段）
 */
export interface AccountWithCookies {
  login_method?: 'channels_helper' | 'shop_helper';
  channels_sessionid?: string;
  channels_wxuin?: string;
  shop_talent_token?: string;
  shop_talent_rand?: string;
  shop_talent_magic?: string;
}

/**
 * 将Cookie数组拆分为独立字段
 *
 * @param cookies Cookie数组
 * @returns 拆分后的字段对象
 *
 * @example
 * const cookies = [
 *   { name: 'sessionid', value: 'xxx' },
 *   { name: 'wxuin', value: 'yyy' }
 * ];
 * const parsed = parseCookies(cookies);
 * // { channels_sessionid: 'xxx', channels_wxuin: 'yyy' }
 */
export function parseCookies(cookies: CookieItem[]): ParsedCookies {
  const result: ParsedCookies = {};

  if (!cookies || cookies.length === 0) {
    return result;
  }

  for (const cookie of cookies) {
    switch (cookie.name) {
      case 'sessionid':
        result.channels_sessionid = cookie.value;
        break;
      case 'wxuin':
        result.channels_wxuin = cookie.value;
        break;
      case 'talent_token':
        result.shop_talent_token = cookie.value;
        break;
      case 'talent_rand':
        result.shop_talent_rand = cookie.value;
        break;
      case 'talent_magic':
        result.shop_talent_magic = cookie.value;
        break;
    }
  }

  return result;
}

/**
 * 检测登录方式
 *
 * @param parsed 拆分后的Cookie字段
 * @returns 登录方式
 */
export function detectLoginMethod(parsed: ParsedCookies): 'channels_helper' | 'shop_helper' {
  // 优先判断小店助手（talent_token是唯一标识）
  if (parsed.shop_talent_token) {
    return 'shop_helper';
  }

  // 默认视频号助手
  return 'channels_helper';
}

/**
 * 将拆分字段组装为Cookie数组（用于同步到比特浏览器）
 * 根据 login_method 只组装对应类型的Cookie，避免混合导入
 *
 * @param account 包含拆分字段的账号数据
 * @returns Cookie数组
 *
 * @example
 * const account = {
 *   login_method: 'channels_helper',
 *   channels_sessionid: 'xxx',
 *   channels_wxuin: 'yyy',
 *   shop_talent_token: 'zzz'  // 有但不会组装
 * };
 * const cookies = assembleCookies(account);
 * // [
 * //   { name: 'sessionid', value: 'xxx', domain: '.weixin.qq.com' },
 * //   { name: 'wxuin', value: 'yyy', domain: '.weixin.qq.com' }
 * // ]
 */
export function assembleCookies(account: AccountWithCookies): CookieItem[] {
  const cookies: CookieItem[] = [];

  // 确定登录方式
  const loginMethod = account.login_method || detectLoginMethod(account);

  // 根据登录方式只组装对应类型的Cookie
  if (loginMethod === 'channels_helper') {
    // 组装视频号Cookie
    if (account.channels_sessionid) {
      cookies.push({
        name: 'sessionid',
        value: account.channels_sessionid,
        domain: '.weixin.qq.com'
      });
    }

    if (account.channels_wxuin) {
      cookies.push({
        name: 'wxuin',
        value: account.channels_wxuin,
        domain: '.weixin.qq.com'
      });
    }
  } else {
    // 组装小店助手Cookie
    if (account.shop_talent_token) {
      cookies.push({
        name: 'talent_token',
        value: account.shop_talent_token,
        domain: '.weixin.qq.com'
      });
    }

    if (account.shop_talent_rand) {
      cookies.push({
        name: 'talent_rand',
        value: account.shop_talent_rand,
        domain: '.weixin.qq.com'
      });
    }

    if (account.shop_talent_magic) {
      cookies.push({
        name: 'talent_magic',
        value: account.shop_talent_magic,
        domain: '.weixin.qq.com'
      });
    }
  }

  return cookies;
}

/**
 * 组装为Cookie字符串（用于HTTP请求头）
 *
 * @param account 包含拆分字段的账号数据
 * @returns Cookie字符串 (name=value; name2=value2)
 *
 * @example
 * const account = {
 *   channels_sessionid: 'xxx',
 *   channels_wxuin: 'yyy'
 * };
 * const cookieStr = assembleCookieString(account);
 * // "sessionid=xxx; wxuin=yyy"
 */
export function assembleCookieString(account: AccountWithCookies): string {
  const cookies = assembleCookies(account);
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

/**
 * 提取视频号Cookie（用于API调用）
 *
 * @param account 账号数据
 * @returns 视频号Cookie对象，如果不存在则返回null
 */
export function extractChannelsCookie(account: AccountWithCookies): { sessionid: string; wxuin: string } | null {
  if (account.channels_sessionid && account.channels_wxuin) {
    return {
      sessionid: account.channels_sessionid,
      wxuin: account.channels_wxuin
    };
  }
  return null;
}

/**
 * 提取小店助手Cookie（用于API调用）
 *
 * @param account 账号数据
 * @returns 小店助手Cookie对象，如果不存在则返回null
 */
export function extractShopCookie(account: AccountWithCookies): {
  talent_token: string;
  talent_magic: string;
  talent_rand?: string;
} | null {
  if (account.shop_talent_token && account.shop_talent_magic) {
    return {
      talent_token: account.shop_talent_token,
      talent_magic: account.shop_talent_magic,
      talent_rand: account.shop_talent_rand
    };
  }
  return null;
}

/**
 * 判断账号是否有有效的Cookie
 *
 * @param account 账号数据
 * @returns 是否有有效Cookie
 */
export function hasValidCookie(account: AccountWithCookies): boolean {
  const loginMethod = account.login_method || detectLoginMethod(account);

  if (loginMethod === 'channels_helper') {
    return !!(account.channels_sessionid && account.channels_wxuin);
  } else {
    return !!(account.shop_talent_token && account.shop_talent_magic);
  }
}

/**
 * 获取Cookie字符串（根据登录方式自动选择）
 *
 * @param account 账号数据
 * @returns Cookie字符串，如果没有有效Cookie则返回空字符串
 */
export function getCookieString(account: AccountWithCookies): string {
  if (!hasValidCookie(account)) {
    return '';
  }

  return assembleCookieString(account);
}
