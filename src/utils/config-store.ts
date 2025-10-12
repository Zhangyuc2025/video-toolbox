/**
 * 配置存储管理
 * 使用 Rust 后端实现持久化配置
 */
import { invoke } from '@tauri-apps/api/tauri'

class ConfigStore {
  private static instance: ConfigStore

  private constructor() {
    // 配置管理在Rust端，这里不需要初始化
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ConfigStore {
    if (!ConfigStore.instance) {
      ConfigStore.instance = new ConfigStore()
    }
    return ConfigStore.instance
  }

  // ========== 基础配置 ==========

  /**
   * 获取比特浏览器路径
   */
  async getBitBrowserPath(): Promise<string> {
    return (await invoke<string | null>('config_get_string', { key: 'bitbrowser_path' })) || ''
  }

  /**
   * 设置比特浏览器路径
   */
  async setBitBrowserPath(path: string): Promise<void> {
    await invoke('config_set_string', { key: 'bitbrowser_path', value: path })
  }

  /**
   * 获取比特浏览器API地址
   */
  async getBitBrowserApi(): Promise<string> {
    return (await invoke<string | null>('config_get_string', { key: 'bitbrowser_api' })) || 'http://127.0.0.1:54345'
  }

  /**
   * 设置比特浏览器API地址
   */
  async setBitBrowserApi(api: string): Promise<void> {
    await invoke('config_set_string', { key: 'bitbrowser_api', value: api })
  }

  /**
   * 获取用户名
   */
  async getUsername(): Promise<string> {
    return (await invoke<string | null>('config_get_string', { key: 'username' })) || ''
  }

  /**
   * 设置用户名
   */
  async setUsername(username: string): Promise<void> {
    await invoke('config_set_string', { key: 'username', value: username })
  }

  /**
   * 获取"只看我的账号"开关
   */
  async getFilterMyAccounts(): Promise<boolean> {
    const value = await invoke<boolean | null>('config_get_bool', { key: 'filter_my_accounts' })
    return value ?? true // 默认开启
  }

  /**
   * 设置"只看我的账号"开关
   */
  async setFilterMyAccounts(enabled: boolean): Promise<void> {
    await invoke('config_set_bool', { key: 'filter_my_accounts', value: enabled })
  }

  /**
   * 获取会员模式开关
   */
  async getMemberMode(): Promise<boolean> {
    const value = await invoke<boolean | null>('config_get_bool', { key: 'member_mode' })
    return value ?? false // 默认关闭
  }

  /**
   * 设置会员模式开关
   */
  async setMemberMode(enabled: boolean): Promise<void> {
    await invoke('config_set_bool', { key: 'member_mode', value: enabled })
  }

  /**
   * 获取 BitBrowser VIP 模式（API 限流速率控制）
   */
  async getBitBrowserVipMode(): Promise<boolean> {
    const value = await invoke<boolean | null>('config_get_bool', { key: 'bitbrowser_vip_mode' })
    return value ?? true // 默认 VIP 模式（8req/s）
  }

  /**
   * 设置 BitBrowser VIP 模式（API 限流速率控制）
   */
  async setBitBrowserVipMode(enabled: boolean): Promise<void> {
    await invoke('config_set_bool', { key: 'bitbrowser_vip_mode', value: enabled })
  }

  // ========== 账号信息配置（Cookie从BitBrowser读取，不再本地存储） ==========

  /**
   * 获取所有账号信息映射表
   */
  async getBrowserAccounts(): Promise<Cookie.AccountMap> {
    return (await invoke<Cookie.AccountMap>('config_get_all_accounts')) || {}
  }

  /**
   * 保存单个浏览器的账号信息
   */
  async saveBrowserAccount(browserId: string, accountData: Cookie.AccountData): Promise<void> {
    const dataToSave = {
      ...accountData,
      updatedAt: new Date().toISOString()
    }
    await invoke('config_save_account', { browserId, accountData: dataToSave })
  }

  /**
   * 获取单个浏览器的账号信息
   */
  async getBrowserAccount(browserId: string): Promise<Cookie.AccountData | null> {
    return await invoke<Cookie.AccountData | null>('config_get_account', { browserId })
  }

  /**
   * 更新账号信息（不包括loginMethod和loginTime）
   */
  async updateAccountInfo(browserId: string, accountInfo: Cookie.AccountInfo): Promise<void> {
    const account = await this.getBrowserAccount(browserId)
    if (account) {
      account.accountInfo = accountInfo
      account.updatedAt = new Date().toISOString()
      await this.saveBrowserAccount(browserId, account)
    }
  }

  /**
   * 删除单个浏览器的账号信息
   */
  async deleteBrowserAccount(browserId: string): Promise<void> {
    await invoke('config_delete_account', { browserId })
  }

  /**
   * 批量删除账号信息（根据browser_id列表）
   */
  async deleteBrowserAccounts(browserIds: string[]): Promise<void> {
    await invoke('config_delete_accounts', { browserIds })
  }


  // ========== 代理配置 ==========

  /**
   * 获取代理列表
   */
  async getProxies(): Promise<Proxy.ProxyInfo[]> {
    return (await this.store.get<Proxy.ProxyInfo[]>('proxies')) || []
  }

  /**
   * 保存代理列表
   */
  async saveProxies(proxies: Proxy.ProxyInfo[]): Promise<void> {
    await this.store.set('proxies', proxies)
    await this.store.save()
  }

  /**
   * 添加代理
   */
  async addProxy(proxy: Proxy.ProxyInfo): Promise<void> {
    const proxies = await this.getProxies()
    proxies.push(proxy)
    await this.saveProxies(proxies)
  }

  /**
   * 更新代理
   */
  async updateProxy(index: number, proxy: Proxy.ProxyInfo): Promise<void> {
    const proxies = await this.getProxies()
    if (index >= 0 && index < proxies.length) {
      proxies[index] = proxy
      await this.saveProxies(proxies)
    }
  }

  /**
   * 删除代理
   */
  async deleteProxy(index: number): Promise<void> {
    const proxies = await this.getProxies()
    if (index >= 0 && index < proxies.length) {
      proxies.splice(index, 1)
      await this.saveProxies(proxies)
    }
  }

  // ========== Cookie 保活配置 ==========

  /**
   * 获取保活配置
   */
  async getKeepAliveConfig(): Promise<Config.KeepAliveConfig> {
    const config = await this.store.get<Config.KeepAliveConfig>('keep_alive_config')
    return (
      config || {
        enabled: true,
        checkInterval: 20,
        maxConcurrent: 5,
        retryOnError: true,
        retryInterval: 5,
        notifyOnExpire: true
      }
    )
  }

  /**
   * 保存保活配置
   */
  async saveKeepAliveConfig(config: Config.KeepAliveConfig): Promise<void> {
    await this.store.set('keep_alive_config', config)
    await this.store.save()
  }

  // ========== 界面配置 ==========

  /**
   * 获取界面配置
   */
  async getUIConfig(): Promise<Config.UIConfig> {
    const config = await this.store.get<Config.UIConfig>('ui_config')
    return (
      config || {
        themeMode: 'auto',
        themeColor: '#18A058',
        cardDensity: 'standard',
        enableAnimation: true
      }
    )
  }

  /**
   * 保存界面配置
   */
  async saveUIConfig(config: Config.UIConfig): Promise<void> {
    await this.store.set('ui_config', config)
    await this.store.save()
  }

  // ========== 通知配置 ==========

  /**
   * 获取通知配置
   */
  async getNotificationConfig(): Promise<Config.NotificationConfig> {
    const config = await this.store.get<Config.NotificationConfig>('notification_config')
    return (
      config || {
        cookieExpired: true,
        checkError: true,
        batchComplete: true
      }
    )
  }

  /**
   * 保存通知配置
   */
  async saveNotificationConfig(config: Config.NotificationConfig): Promise<void> {
    await this.store.set('notification_config', config)
    await this.store.save()
  }

  // ========== 通用方法 ==========

  /**
   * 获取任意键的值
   */
  async get<T = any>(key: string): Promise<T | null> {
    return await this.store.get<T>(key)
  }

  /**
   * 设置任意键的值
   */
  async set(key: string, value: any): Promise<void> {
    await this.store.set(key, value)
    await this.store.save()
  }

  /**
   * 删除指定键
   */
  async delete(key: string): Promise<void> {
    await this.store.delete(key)
    await this.store.save()
  }

  /**
   * 清空所有配置（危险操作）
   */
  async clear(): Promise<void> {
    await this.store.clear()
    await this.store.save()
  }

  /**
   * 获取所有键
   */
  async keys(): Promise<string[]> {
    return await this.store.keys()
  }

  /**
   * 检查键是否存在
   */
  async has(key: string): Promise<boolean> {
    return await this.store.has(key)
  }

  /**
   * 手动保存（通常自动保存，特殊情况手动调用）
   */
  async save(): Promise<void> {
    await this.store.save()
  }
}

// 导出单例
export const configStore = ConfigStore.getInstance()

// 导出类型（方便测试时创建新实例）
export { ConfigStore }
