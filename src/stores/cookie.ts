/**
 * Account Store (原Cookie Store)
 * 管理账号信息状态，Cookie从BitBrowser实时读取
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { services } from '@/services'

export const useCookieStore = defineStore('cookie', () => {
  // ========== 状态 ==========

  /** 账号信息映射表 */
  const accounts = ref<Cookie.AccountMap>({})

  /** 加载状态 */
  const loading = ref(false)

  /** 最后更新时间 */
  const lastUpdated = ref<Date | null>(null)

  // ========== 计算属性 ==========

  /** 账号总数 */
  const total = computed(() => Object.keys(accounts.value).length)

  /** 视频号助手账号数 */
  const channelsHelperCount = computed(() => {
    return Object.values(accounts.value).filter(a => a.loginMethod === 'channels_helper').length
  })

  /** 小店带货助手账号数 */
  const shopHelperCount = computed(() => {
    return Object.values(accounts.value).filter(a => a.loginMethod === 'shop_helper').length
  })

  /** 账号统计信息 */
  const stats = computed(() => ({
    total: total.value,
    channelsHelper: channelsHelperCount.value,
    shopHelper: shopHelperCount.value
  }))

  // ========== Actions ==========

  /**
   * 加载所有账号信息
   */
  async function loadCookies(): Promise<void> {
    loading.value = true

    try {
      accounts.value = await services.cookie.getAllBrowserAccounts()
      lastUpdated.value = new Date()
    } catch (error) {
      console.error('加载账号信息失败:', error)
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取浏览器的账号信息
   */
  function getCookie(browserId: string): Cookie.AccountData | null {
    return accounts.value[browserId] || null
  }

  /**
   * 保存浏览器账号信息
   */
  async function saveCookie(browserId: string, accountData: Cookie.AccountData): Promise<boolean> {
    const success = await services.cookie.saveBrowserAccount(browserId, accountData)

    if (success) {
      // 更新本地状态
      accounts.value[browserId] = accountData
      lastUpdated.value = new Date()
    }

    return success
  }

  /**
   * 删除浏览器账号信息
   */
  async function deleteCookie(browserId: string): Promise<boolean> {
    const success = await services.cookie.deleteBrowserAccount(browserId)

    if (success) {
      // 从本地状态移除
      delete accounts.value[browserId]
      lastUpdated.value = new Date()
    }

    return success
  }

  /**
   * 批量删除账号信息
   */
  async function batchDeleteCookies(browserIds: string[]): Promise<boolean> {
    const success = await services.cookie.batchDeleteAccounts(browserIds)

    if (success) {
      // 从本地状态移除
      browserIds.forEach(id => {
        delete accounts.value[id]
      })
      lastUpdated.value = new Date()
    }

    return success
  }

  /**
   * 更新账号信息
   */
  async function updateAccountInfo(
    browserId: string,
    accountInfo: Cookie.AccountInfo
  ): Promise<boolean> {
    const success = await services.cookie.updateAccountInfo(browserId, accountInfo)

    if (success) {
      const account = getCookie(browserId)
      if (account) {
        account.accountInfo = accountInfo
        account.updatedAt = new Date().toISOString()
      }
    }

    return success
  }

  /**
   * 刷新账号数据
   */
  async function refresh(): Promise<void> {
    await loadCookies()
  }

  /**
   * 检查浏览器是否有账号信息
   */
  function hasCookie(browserId: string): boolean {
    return browserId in accounts.value
  }

  /**
   * 获取所有浏览器ID列表
   */
  function getAllIds(): string[] {
    return Object.keys(accounts.value)
  }

  // ========== Cookie读取（从BitBrowser） ==========

  /**
   * 从BitBrowser获取浏览器Cookie
   */
  async function getBrowserCookies(browserId: string): Promise<Cookie.Cookie[]> {
    return services.cookie.getBrowserCookies(browserId)
  }

  /**
   * 将Cookie转换为字符串
   */
  function cookiesToString(cookies: Cookie.Cookie[]): string {
    return services.cookie.cookiesToString(cookies)
  }

  // ========== 废弃方法（保留方法名但简化实现） ==========

  /**
   * @deprecated Cookie不再本地存储，该方法已废弃
   */
  async function syncToBrowser(browserId: string): Promise<boolean> {
    console.warn('syncToBrowser已废弃：Cookie已在BitBrowser中')
    return true
  }

  /**
   * @deprecated Cookie不再本地存储，该方法已废弃
   */
  async function batchSyncCookies(browserIds: string[]): Promise<number> {
    console.warn('batchSyncCookies已废弃：Cookie已在BitBrowser中')
    return browserIds.length
  }

  /**
   * @deprecated Cookie不再本地存储，无过期检测
   */
  function isExpired(browserId: string): boolean {
    return false
  }

  /**
   * @deprecated Cookie不再本地存储，无过期检测
   */
  function isExpiringSoon(browserId: string, days: number = 3): boolean {
    return false
  }

  /**
   * @deprecated Cookie不再本地存储
   */
  async function incrementRenewal(browserId: string): Promise<boolean> {
    return true
  }

  /**
   * @deprecated Cookie不再本地存储
   */
  async function updateExpiresTime(browserId: string, expiresTime: string): Promise<boolean> {
    return true
  }

  /**
   * @deprecated Cookie不再本地存储
   */
  async function cleanExpired(): Promise<number> {
    return 0
  }

  /**
   * @deprecated 使用 getAllIds 代替
   */
  function getExpiredIds(): string[] {
    return []
  }

  /**
   * @deprecated 使用 getAllIds 代替
   */
  function getExpiringSoonIds(): string[] {
    return []
  }

  /**
   * @deprecated 使用 getAllIds 代替
   */
  function getValidIds(): string[] {
    return getAllIds()
  }

  // ========== 检测状态管理（保留，用于其他功能） ==========

  const checkingIds = ref<Set<string>>(new Set())

  const checkingCount = computed(() => checkingIds.value.size)

  async function isChecking(browserId: string): Promise<boolean> {
    if (checkingIds.value.has(browserId)) {
      return true
    }
    const checking = await services.state.isCookieChecking(browserId)
    if (checking) {
      checkingIds.value.add(browserId)
    }
    return checking
  }

  async function startChecking(browserId: string): Promise<boolean> {
    const success = await services.state.addCheckingCookie(browserId)
    if (success) {
      checkingIds.value.add(browserId)
    }
    return success
  }

  async function stopChecking(browserId: string): Promise<boolean> {
    const success = await services.state.removeCheckingCookie(browserId)
    if (success) {
      checkingIds.value.delete(browserId)
    }
    return success
  }

  async function batchStartChecking(browserIds: string[]): Promise<boolean> {
    const success = await services.state.batchAddCheckingCookies(browserIds)
    if (success) {
      browserIds.forEach(id => checkingIds.value.add(id))
    }
    return success
  }

  async function batchStopChecking(browserIds: string[]): Promise<boolean> {
    const success = await services.state.batchRemoveCheckingCookies(browserIds)
    if (success) {
      browserIds.forEach(id => checkingIds.value.delete(id))
    }
    return success
  }

  async function clearChecking(): Promise<boolean> {
    const success = await services.state.clearCheckingCookies()
    if (success) {
      checkingIds.value.clear()
    }
    return success
  }

  // ========== 重置状态 ==========

  function $reset(): void {
    accounts.value = {}
    loading.value = false
    checkingIds.value.clear()
    lastUpdated.value = null
  }

  // ========== 兼容旧API（返回值） ==========

  /**
   * 为了兼容旧代码，保留 cookies 属性（实际指向 accounts）
   */
  const cookies = computed(() => {
    const result: Cookie.CookieMap = {}
    for (const [browserId, accountData] of Object.entries(accounts.value)) {
      result[browserId] = {
        ...accountData,
        cookies: [],
        renewalCount: 0
      }
    }
    return result
  })

  const validCookies = computed(() => cookies.value)
  const validCount = computed(() => total.value)
  const expiredCookies = computed(() => ({}))
  const expiredCount = computed(() => 0)
  const expiringSoonCookies = computed(() => ({}))
  const expiringSoonCount = computed(() => 0)

  return {
    // 新状态
    accounts,
    loading,
    lastUpdated,
    checkingIds,

    // 新计算属性
    total,
    channelsHelperCount,
    shopHelperCount,
    stats,
    checkingCount,

    // 主要Actions
    loadCookies,
    getCookie,
    saveCookie,
    deleteCookie,
    batchDeleteCookies,
    updateAccountInfo,
    refresh,
    hasCookie,
    getAllIds,

    // Cookie读取
    getBrowserCookies,
    cookiesToString,

    // 检测状态
    isChecking,
    startChecking,
    stopChecking,
    batchStartChecking,
    batchStopChecking,
    clearChecking,

    // 废弃方法（保留接口）
    syncToBrowser,
    batchSyncCookies,
    isExpired,
    isExpiringSoon,
    incrementRenewal,
    updateExpiresTime,
    cleanExpired,
    getExpiredIds,
    getExpiringSoonIds,
    getValidIds,

    // 兼容旧API
    cookies,
    validCookies,
    validCount,
    expiredCookies,
    expiredCount,
    expiringSoonCookies,
    expiringSoonCount,

    // 重置
    $reset
  }
})
