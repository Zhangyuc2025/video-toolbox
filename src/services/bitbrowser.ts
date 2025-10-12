/**
 * BitBrowser Service
 * 封装所有比特浏览器相关的 API 调用
 */
import { BaseService, ApiResponse } from './base'
import { CloudService } from './cloud'
import { configStore } from '@/utils/config-store'

/**
 * 浏览器列表响应数据
 */
interface BrowserListData {
  list: Browser.BrowserInfo[]
  total: number
}

/**
 * 浏览器详情响应数据
 */
interface BrowserDetailData {
  id: string
  name: string
  remark?: string
  proxyType?: Browser.ProxyType
  host?: string
  port?: string
  proxyUserName?: string
  proxyPassword?: string
  cookiesList?: Cookie.Cookie[]
  [key: string]: any
}

/**
 * 浏览器打开响应数据
 */
interface BrowserOpenData {
  ws: {
    selenium: string
    puppeteer: string
  }
  http: string
  webdriver: string
}

/**
 * 创建浏览器参数
 */
export interface CreateBrowserParams {
  name: string
  remark?: string
  proxyType?: Browser.ProxyType
  proxyConfig?: {
    host: string
    port: string
    username?: string
    password?: string
  }
  openUrl?: string
}

/**
 * 更新浏览器参数
 */
export interface UpdateBrowserParams {
  id: string
  name?: string
  remark?: string
  proxyType?: Browser.ProxyType
  proxyConfig?: {
    host: string
    port: string
    username?: string
    password?: string
  }
  openUrl?: string
}

/**
 * 同步 Cookie 参数
 */
export interface SyncCookiesParams {
  browserId: string
  cookies: Cookie.Cookie[]
}

/**
 * BitBrowser Service 类
 */
export class BitBrowserService extends BaseService {
  /**
   * 检查比特浏览器连接状态
   * 使用直接 API 调用而不是 sidecar
   */
  async checkConnection(): Promise<boolean> {
    const result = await this.invoke<void>('check_bitbrowser_status')
    return result.success
  }

  /**
   * 获取浏览器列表
   */
  async getBrowserList(): Promise<Browser.BrowserInfo[]> {
    const result = await this.invoke<BrowserListData>('bb_get_browser_list')

    if (result.success && result.data) {
      return result.data.list || []
    }

    return []
  }

  /**
   * 获取浏览器详情
   */
  async getBrowserDetail(browserId: string): Promise<BrowserDetailData | null> {
    if (!this.validateRequired({ browserId }, ['browserId'])) {
      return null
    }

    const result = await this.invoke<BrowserDetailData>('bb_get_browser_detail', { browserId })

    if (result.success && result.data) {
      return result.data
    }

    return null
  }

  /**
   * 打开浏览器
   * 打开前会先验证Cookie状态，避免打开失效账号
   */
  async openBrowser(browserId: string): Promise<BrowserOpenData | null> {
    if (!this.validateRequired({ browserId }, ['browserId'])) {
      return null
    }

    // 检查是否已注册云端账号
    const accounts = await configStore.getBrowserAccounts()
    const isRegistered = !!accounts[browserId]

    if (isRegistered) {
      // 打开前先验证Cookie
      console.log(`[BitBrowser] 打开前验证Cookie: ${browserId}`)

      const validation = await CloudService.instantValidateCookie(browserId)

      if (!validation) {
        // 验证失败（网络错误等），终止打开
        this.showMessage('error', `Cookie验证失败，请检查网络连接`)
        console.log(`[BitBrowser] Cookie验证失败，终止打开: ${browserId}`)
        return null
      }

      if (!validation.valid) {
        // 账号已掉线，提示用户
        this.showMessage('error', `账号已掉线: ${validation.nickname || browserId}，请重新登录`)
        console.log(`[BitBrowser] 账号已掉线，终止打开: ${browserId}`)
        return null
      }

      console.log(`[BitBrowser] Cookie有效，继续打开: ${browserId}`)
    }

    const result = await this.invoke<BrowserOpenData>('bb_open_browser', { browserId })

    if (result.success && result.data) {
      return result.data
    }

    return null
  }

  /**
   * 关闭浏览器
   */
  async closeBrowser(browserId: string): Promise<boolean> {
    if (!this.validateRequired({ browserId }, ['browserId'])) {
      return false
    }

    const result = await this.invoke<void>('bb_close_browser', { browserId })
    return result.success
  }

  /**
   * 删除浏览器（支持批量）
   */
  async deleteBrowsers(browserIds: string[]): Promise<boolean> {
    if (!browserIds || browserIds.length === 0) {
      this.showMessage('error', '请选择要删除的浏览器')
      return false
    }

    const idsString = browserIds.join(',')
    const result = await this.invoke<void>('bb_delete_browsers', { browserIds: idsString })

    return result.success
  }

  /**
   * 创建浏览器
   */
  async createBrowser(params: CreateBrowserParams): Promise<string | null> {
    if (!this.validateRequired(params, ['name'])) {
      return null
    }

    const result = await this.invoke<{ id: string }>('bb_create_browser', { params })

    if (result.success && result.data) {
      return result.data.id
    }

    return null
  }

  /**
   * 更新浏览器配置
   */
  async updateBrowser(params: UpdateBrowserParams): Promise<boolean> {
    if (!this.validateRequired(params, ['id'])) {
      return false
    }

    const result = await this.invoke<void>('bb_update_browser', { params })
    return result.success
  }

  /**
   * 同步 Cookie 到浏览器
   */
  async syncCookies(params: SyncCookiesParams): Promise<boolean> {
    if (!this.validateRequired(params, ['browserId', 'cookies'])) {
      return false
    }

    const result = await this.invoke<void>('bb_sync_cookies', { params })
    return result.success
  }

  /**
   * 批量打开浏览器
   */
  async batchOpenBrowsers(browserIds: string[]): Promise<ApiResponse[]> {
    if (!browserIds || browserIds.length === 0) {
      this.showMessage('error', '请选择要打开的浏览器')
      return []
    }

    const result = await this.invoke<ApiResponse[]>('bb_batch_open_browsers', { browserIds })

    if (result.success && result.data) {
      const successCount = result.data.filter(r => r.success).length
      const failedCount = result.data.length - successCount

      if (failedCount === 0) {
        this.showMessage('success', `成功打开 ${successCount} 个浏览器`)
      } else {
        this.showMessage('warning', `成功: ${successCount}, 失败: ${failedCount}`)
      }

      return result.data
    }

    return []
  }

  /**
   * 批量关闭浏览器
   */
  async batchCloseBrowsers(browserIds: string[]): Promise<ApiResponse[]> {
    if (!browserIds || browserIds.length === 0) {
      this.showMessage('error', '请选择要关闭的浏览器')
      return []
    }

    const result = await this.invoke<ApiResponse[]>('bb_batch_close_browsers', { browserIds })

    if (result.success && result.data) {
      const successCount = result.data.filter(r => r.success).length
      this.showMessage('success', `成功关闭 ${successCount} 个浏览器`)

      return result.data
    }

    return []
  }

  /**
   * 批量删除浏览器
   */
  async batchDeleteBrowsers(browserIds: string[]): Promise<boolean> {
    return this.deleteBrowsers(browserIds)
  }

  /**
   * 根据名称查找浏览器
   */
  async findBrowserByName(name: string): Promise<Browser.BrowserInfo | null> {
    const browsers = await this.getBrowserList()
    return browsers.find(b => b.name === name) || null
  }

  /**
   * 获取正在运行的浏览器
   */
  async getRunningBrowsers(): Promise<Browser.BrowserInfo[]> {
    const browsers = await this.getBrowserList()
    return browsers.filter(b => b.isRunning)
  }

  /**
   * 获取未运行的浏览器
   */
  async getStoppedBrowsers(): Promise<Browser.BrowserInfo[]> {
    const browsers = await this.getBrowserList()
    return browsers.filter(b => !b.isRunning)
  }

  /**
   * 检查浏览器是否存在
   */
  async isBrowserExists(browserId: string): Promise<boolean> {
    const detail = await this.getBrowserDetail(browserId)
    return detail !== null
  }

  /**
   * 切换浏览器状态（打开/关闭）
   */
  async toggleBrowser(browserId: string, isRunning: boolean): Promise<boolean> {
    if (isRunning) {
      return this.closeBrowser(browserId)
    } else {
      const result = await this.openBrowser(browserId)
      return result !== null
    }
  }

  /**
   * 重启浏览器（先关闭再打开）
   */
  async restartBrowser(browserId: string, delay: number = 1000): Promise<boolean> {
    const closed = await this.closeBrowser(browserId)

    if (!closed) {
      return false
    }

    await this.delay(delay)

    const opened = await this.openBrowser(browserId)
    return opened !== null
  }

  /**
   * 批量重启浏览器
   */
  async batchRestartBrowsers(browserIds: string[], delay: number = 1000): Promise<boolean> {
    // 先关闭所有
    await this.batchCloseBrowsers(browserIds)

    // 等待
    await this.delay(delay)

    // 再打开所有
    const results = await this.batchOpenBrowsers(browserIds)

    return results.every(r => r.success)
  }
}

// 注意：不再直接导出单例，服务实例由容器管理
// 请从 @/services 导入 bitBrowserService
