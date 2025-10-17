/**
 * Cookie & Account Service
 * Cookie从BitBrowser实时读取，本地只存储账号信息
 */
import { invoke } from '@tauri-apps/api/tauri'
import { BaseService } from './base'
import { configStore } from '@/utils/config-store'

/**
 * Cookie Service 类
 */
export class CookieService extends BaseService {
  // ========== 账号信息管理 ==========

  /**
   * 保存浏览器账号信息
   */
  async saveBrowserAccount(browserId: string, accountData: Cookie.AccountData): Promise<boolean> {
    try {
      await configStore.saveBrowserAccount(browserId, accountData)
      this.log('success', `保存账号信息成功: ${browserId}`)
      return true
    } catch (error) {
      this.log('error', '保存账号信息失败', error)
      this.showMessage('error', '保存账号信息失败')
      return false
    }
  }

  /**
   * 获取浏览器账号信息
   */
  async getBrowserAccount(browserId: string): Promise<Cookie.AccountData | null> {
    try {
      const account = await configStore.getBrowserAccount(browserId)
      return account
    } catch (error) {
      this.log('error', '获取账号信息失败', error)
      return null
    }
  }

  /**
   * 获取所有浏览器账号信息
   */
  async getAllBrowserAccounts(): Promise<Cookie.AccountMap> {
    try {
      const accounts = await configStore.getBrowserAccounts()
      return accounts
    } catch (error) {
      this.log('error', '获取所有账号信息失败', error)
      return {}
    }
  }

  /**
   * 更新账号信息
   */
  async updateAccountInfo(browserId: string, accountInfo: Cookie.AccountInfo): Promise<boolean> {
    try {
      await configStore.updateAccountInfo(browserId, accountInfo)
      this.log('success', `更新账号信息成功: ${browserId}`)
      return true
    } catch (error) {
      this.log('error', '更新账号信息失败', error)
      return false
    }
  }

  /**
   * 删除浏览器账号信息
   */
  async deleteBrowserAccount(browserId: string): Promise<boolean> {
    try {
      await configStore.deleteBrowserAccount(browserId)
      this.log('success', `删除账号信息成功: ${browserId}`)
      return true
    } catch (error) {
      this.log('error', '删除账号信息失败', error)
      return false
    }
  }

  /**
   * 批量删除账号信息
   */
  async batchDeleteAccounts(browserIds: string[]): Promise<boolean> {
    try {
      await configStore.deleteBrowserAccounts(browserIds)
      this.log('success', `批量删除账号信息成功: ${browserIds.length} 个`)
      this.showMessage('success', `成功删除 ${browserIds.length} 个账号`)
      return true
    } catch (error) {
      this.log('error', '批量删除账号信息失败', error)
      this.showMessage('error', '批量删除失败')
      return false
    }
  }

  // ========== Cookie读取（从BitBrowser） ==========

  /**
   * 从BitBrowser获取浏览器Cookie
   */
  async getBrowserCookies(browserId: string): Promise<Cookie.Cookie[]> {
    try {
      const result = await invoke<{ success: boolean; data?: { cookies: Cookie.Cookie[] }; message: string }>(
        'get_browser_cookies',
        { browserId }
      )

      if (result.success && result.data?.cookies) {
        this.log('success', `从BitBrowser获取Cookie成功: ${browserId}`)
        return result.data.cookies
      } else {
        this.log('warn', `获取Cookie失败: ${result.message}`)
        return []
      }
    } catch (error) {
      this.log('error', '从BitBrowser获取Cookie失败', error)
      return []
    }
  }

  /**
   * 将Cookie数组转换为字符串格式（name=value; name2=value2）
   */
  cookiesToString(cookies: Cookie.Cookie[]): string {
    return cookies.map(c => `${c.name}=${c.value}`).join('; ')
  }

  /**
   * 将Cookie字符串解析为数组
   */
  parseCookieString(cookieStr: string, domain: string = '.weixin.qq.com'): Cookie.Cookie[] {
    return cookieStr.split('; ').map(pair => {
      const [name, value] = pair.split('=')
      return {
        name,
        value,
        domain
      }
    })
  }

  // ========== 统计信息 ==========

  /**
   * 获取账号统计信息
   * ✅ loginMethod 从云端缓存获取（不再从本地存储读取）
   */
  async getAccountStats(): Promise<{
    total: number
    channelsHelper: number
    shopHelper: number
  }> {
    const allAccounts = await this.getAllBrowserAccounts()
    const browserIds = Object.keys(allAccounts)
    const total = browserIds.length
    let channelsHelper = 0
    let shopHelper = 0

    // ✅ 动态导入 AccountMonitorService，避免循环依赖
    const { AccountMonitorService } = await import('./account-monitor')

    for (const browserId of browserIds) {
      // 从云端缓存获取 loginMethod
      const status = AccountMonitorService.getAccountStatus(browserId)
      const loginMethod = status?.accountInfo?.loginMethod || 'channels_helper' // 默认值

      if (loginMethod === 'channels_helper') {
        channelsHelper++
      } else if (loginMethod === 'shop_helper') {
        shopHelper++
      }
    }

    return { total, channelsHelper, shopHelper }
  }

  // ========== 兼容旧API（废弃） ==========

  /**
   * @deprecated Cookie不再本地存储，使用 getBrowserCookies 从BitBrowser读取
   */
  async getBrowserCookie(browserId: string): Promise<Cookie.CookieData | null> {
    const account = await this.getBrowserAccount(browserId)
    if (!account) return null

    // 为了兼容性返回旧格式，但cookies为空数组
    return {
      ...account,
      cookies: [],
      renewalCount: 0
    }
  }

  /**
   * @deprecated 使用 getAllBrowserAccounts 代替
   */
  async getAllBrowserCookies(): Promise<Cookie.CookieMap> {
    const accounts = await this.getAllBrowserAccounts()
    const result: Cookie.CookieMap = {}

    for (const [browserId, accountData] of Object.entries(accounts)) {
      result[browserId] = {
        ...accountData,
        cookies: [],
        renewalCount: 0
      }
    }

    return result
  }

  /**
   * @deprecated 使用 deleteBrowserAccount 代替
   */
  async deleteBrowserCookie(browserId: string): Promise<boolean> {
    return this.deleteBrowserAccount(browserId)
  }

  /**
   * @deprecated 使用 batchDeleteAccounts 代替
   */
  async batchDeleteCookies(browserIds: string[]): Promise<boolean> {
    return this.batchDeleteAccounts(browserIds)
  }

  /**
   * @deprecated Cookie不再本地存储，无需同步
   */
  async syncCookieToBrowser(browserId: string): Promise<boolean> {
    this.log('warn', 'syncCookieToBrowser已废弃：Cookie已经在BitBrowser中')
    return true
  }

  /**
   * @deprecated Cookie不再本地存储，无需同步
   */
  async batchSyncCookies(browserIds: string[]): Promise<number> {
    this.log('warn', 'batchSyncCookies已废弃：Cookie已经在BitBrowser中')
    return browserIds.length
  }

  /**
   * @deprecated Cookie不再本地存储，无过期检测
   */
  isCookieExpired(cookieData: Cookie.CookieData): boolean {
    return false
  }

  /**
   * @deprecated Cookie不再本地存储，无过期检测
   */
  isCookieExpiringSoon(cookieData: Cookie.CookieData, days: number = 3): boolean {
    return false
  }

  /**
   * @deprecated Cookie不再本地存储
   */
  async getExpiredCookies(): Promise<string[]> {
    return []
  }

  /**
   * @deprecated Cookie不再本地存储
   */
  async getExpiringSoonCookies(days: number = 3): Promise<string[]> {
    return []
  }

  /**
   * @deprecated Cookie不再本地存储
   */
  async getValidCookies(): Promise<string[]> {
    const accounts = await this.getAllBrowserAccounts()
    return Object.keys(accounts)
  }

  /**
   * @deprecated Cookie不再本地存储
   */
  async incrementRenewalCount(browserId: string): Promise<boolean> {
    return true
  }

  /**
   * @deprecated Cookie不再本地存储
   */
  async updateExpiresTime(browserId: string, expiresTime: string): Promise<boolean> {
    return true
  }

  /**
   * @deprecated Cookie不再本地存储
   */
  async getCookieStats(): Promise<{
    total: number
    valid: number
    expired: number
    expiringSoon: number
  }> {
    const total = Object.keys(await this.getAllBrowserAccounts()).length
    return { total, valid: total, expired: 0, expiringSoon: 0 }
  }

  /**
   * @deprecated Cookie不再本地存储
   */
  async cleanExpiredCookies(): Promise<number> {
    return 0
  }
}

// 注意：不再直接导出单例，服务实例由容器管理
// 请从 @/services 导入 cookieService
