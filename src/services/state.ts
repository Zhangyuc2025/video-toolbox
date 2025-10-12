/**
 * State Service
 * 管理 Rust State（运行时状态）
 */
import { invoke } from '@tauri-apps/api'
import { BaseService } from './base'

/**
 * State Service 类
 */
export class StateService extends BaseService {
  /**
   * 获取缓存的浏览器列表
   */
  async getCachedBrowserList(): Promise<Browser.BrowserInfo[]> {
    try {
      const result = await invoke<Browser.BrowserInfo[]>('get_cached_browser_list')
      return result || []
    } catch (error) {
      this.log('error', '获取缓存浏览器列表失败', error)
      return []
    }
  }

  /**
   * 更新浏览器列表缓存
   */
  async updateBrowserCache(browsers: Browser.BrowserInfo[]): Promise<boolean> {
    try {
      await invoke('update_browser_cache', { browsers })
      this.log('success', '更新浏览器缓存成功')
      return true
    } catch (error) {
      this.log('error', '更新浏览器缓存失败', error)
      return false
    }
  }

  /**
   * 检查 Cookie 是否正在检测中
   */
  async isCookieChecking(browserId: string): Promise<boolean> {
    try {
      const result = await invoke<boolean>('is_cookie_checking', { browserId })
      return result
    } catch (error) {
      this.log('error', '检查 Cookie 状态失败', error)
      return false
    }
  }

  /**
   * 添加到正在检测的集合
   */
  async addCheckingCookie(browserId: string): Promise<boolean> {
    try {
      await invoke('add_checking_cookie', { browserId })
      this.log('info', `添加到检测队列: ${browserId}`)
      return true
    } catch (error) {
      this.log('error', '添加检测队列失败', error)
      return false
    }
  }

  /**
   * 从正在检测的集合中移除
   */
  async removeCheckingCookie(browserId: string): Promise<boolean> {
    try {
      await invoke('remove_checking_cookie', { browserId })
      this.log('info', `从检测队列移除: ${browserId}`)
      return true
    } catch (error) {
      this.log('error', '移除检测队列失败', error)
      return false
    }
  }

  /**
   * 检查比特浏览器连接状态（实时检测）
   * 会真实连接比特浏览器 API 进行检测
   */
  async checkBitBrowserConnection(): Promise<{
    success: boolean
    message: string
  }> {
    try {
      // 使用 BaseService 的 invoke 方法（自动应用限流）
      const apiResult = await this.invoke<{ success: boolean; message: string }>('check_bitbrowser_status')

      const result = apiResult.data || { success: false, message: apiResult.message }

      // 同时更新缓存状态
      await this.updateBitBrowserStatus(result.success)

      if (result.success) {
        this.log('success', result.message)
      } else {
        this.log('warning', result.message)
      }

      return result
    } catch (error) {
      this.log('error', '检测比特浏览器连接失败', error)
      await this.updateBitBrowserStatus(false)
      return {
        success: false,
        message: '检测失败：' + String(error)
      }
    }
  }

  /**
   * 获取比特浏览器连接状态（缓存）
   */
  async getBitBrowserStatus(): Promise<boolean> {
    try {
      const result = await invoke<boolean>('get_bitbrowser_status')
      return result
    } catch (error) {
      this.log('error', '获取比特浏览器状态失败', error)
      return false
    }
  }

  /**
   * 更新比特浏览器连接状态（缓存）
   */
  async updateBitBrowserStatus(connected: boolean): Promise<boolean> {
    try {
      await invoke('update_bitbrowser_status', { connected })
      this.log('info', `更新连接状态: ${connected ? '已连接' : '未连接'}`)
      return true
    } catch (error) {
      this.log('error', '更新连接状态失败', error)
      return false
    }
  }

  /**
   * 批量检查 Cookie 状态
   */
  async batchCheckCookieStatus(browserIds: string[]): Promise<Record<string, boolean>> {
    const statusMap: Record<string, boolean> = {}

    for (const browserId of browserIds) {
      statusMap[browserId] = await this.isCookieChecking(browserId)
    }

    return statusMap
  }

  /**
   * 批量添加到检测队列
   */
  async batchAddCheckingCookies(browserIds: string[]): Promise<boolean> {
    const results = await Promise.all(
      browserIds.map(id => this.addCheckingCookie(id))
    )

    return results.every(r => r)
  }

  /**
   * 批量从检测队列移除
   */
  async batchRemoveCheckingCookies(browserIds: string[]): Promise<boolean> {
    const results = await Promise.all(
      browserIds.map(id => this.removeCheckingCookie(id))
    )

    return results.every(r => r)
  }

  /**
   * 清空检测队列（移除所有）
   */
  async clearCheckingCookies(): Promise<boolean> {
    try {
      const browsers = await this.getCachedBrowserList()
      const browserIds = browsers.map(b => b.id)

      return this.batchRemoveCheckingCookies(browserIds)
    } catch (error) {
      this.log('error', '清空检测队列失败', error)
      return false
    }
  }

  /**
   * 同步浏览器列表到缓存
   * 从 BitBrowser API 获取最新列表并更新缓存
   */
  async syncBrowserListCache(): Promise<boolean> {
    try {
      // 这里需要从 BitBrowser Service 获取列表
      // 为了避免循环依赖，我们在这里直接调用 API（使用 BaseService.invoke 自动应用限流）
      const apiResult = await this.invoke<{ list: Browser.BrowserInfo[] }>('bb_get_browser_list')

      if (apiResult.success && apiResult.data) {
        return this.updateBrowserCache(apiResult.data.list)
      }

      return false
    } catch (error) {
      this.log('error', '同步浏览器列表缓存失败', error)
      return false
    }
  }

  /**
   * 获取正在检测的浏览器数量
   */
  async getCheckingCount(): Promise<number> {
    try {
      const browsers = await this.getCachedBrowserList()
      let count = 0

      for (const browser of browsers) {
        const isChecking = await this.isCookieChecking(browser.id)
        if (isChecking) {
          count++
        }
      }

      return count
    } catch (error) {
      this.log('error', '获取检测数量失败', error)
      return 0
    }
  }
}

// 注意：不再直接导出单例，服务实例由容器管理
// 请从 @/services 导入 stateService
