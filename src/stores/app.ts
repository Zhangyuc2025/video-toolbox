/**
 * App Store
 * 管理应用全局状态
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { configStore } from '@/utils/config-store'

export const useAppStore = defineStore('app', () => {
  // ========== 状态 ==========

  /** 比特浏览器路径 */
  const bitBrowserPath = ref('')

  /** 比特浏览器 API 地址 */
  const bitBrowserApi = ref('http://127.0.0.1:54345')

  /** 用户名 */
  const username = ref('')

  /** 只看我的账号开关 */
  const filterMyAccounts = ref(true)

  /** 会员模式开关 */
  const memberMode = ref(false)

  /** 保活配置 */
  const keepAliveConfig = ref<Config.KeepAliveConfig>({
    enabled: true,
    checkInterval: 20,
    maxConcurrent: 5,
    retryOnError: true,
    retryInterval: 5,
    notifyOnExpire: true
  })

  /** UI 配置 */
  const uiConfig = ref<Config.UIConfig>({
    themeMode: 'auto',
    themeColor: '#18A058',
    cardDensity: 'standard',
    enableAnimation: true
  })

  /** 通知配置 */
  const notificationConfig = ref<Config.NotificationConfig>({
    cookieExpired: true,
    checkError: true,
    batchComplete: true
  })

  /** 应用初始化状态 */
  const initialized = ref(false)

  /** 比特浏览器连接状态 */
  const bitBrowserConnected = ref(false)

  // ========== 计算属性 ==========

  /** 是否配置了比特浏览器路径 */
  const hasBitBrowserPath = computed(() => bitBrowserPath.value.trim() !== '')

  /** 是否配置了用户名 */
  const hasUsername = computed(() => username.value.trim() !== '')

  /** 应用是否完成基础配置 */
  const isConfigured = computed(() => hasBitBrowserPath.value)

  /** 当前主题模式 */
  const currentThemeMode = computed(() => {
    if (uiConfig.value.themeMode === 'auto') {
      // 检测系统主题
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return 'light'
    }

    return uiConfig.value.themeMode
  })

  /** 是否暗色模式 */
  const isDark = computed(() => currentThemeMode.value === 'dark')

  // ========== Actions ==========

  /**
   * 初始化应用配置
   */
  async function initialize(): Promise<void> {
    try {
      // 加载基础配置
      bitBrowserPath.value = await configStore.getBitBrowserPath()
      bitBrowserApi.value = await configStore.getBitBrowserApi()
      username.value = await configStore.getUsername()
      filterMyAccounts.value = await configStore.getFilterMyAccounts()
      memberMode.value = await configStore.getMemberMode()

      // 加载保活配置
      keepAliveConfig.value = await configStore.getKeepAliveConfig()

      // 加载 UI 配置
      uiConfig.value = await configStore.getUIConfig()

      // 加载通知配置
      notificationConfig.value = await configStore.getNotificationConfig()

      initialized.value = true
    } catch (error) {
      console.error('初始化应用配置失败:', error)
    }
  }

  /**
   * 设置比特浏览器路径
   */
  async function setBitBrowserPath(path: string): Promise<void> {
    bitBrowserPath.value = path
    await configStore.setBitBrowserPath(path)
  }

  /**
   * 设置比特浏览器 API 地址
   */
  async function setBitBrowserApi(api: string): Promise<void> {
    bitBrowserApi.value = api
    await configStore.setBitBrowserApi(api)
  }

  /**
   * 设置用户名
   */
  async function setUsername(name: string): Promise<void> {
    username.value = name
    await configStore.setUsername(name)
  }

  /**
   * 设置"只看我的账号"开关
   */
  async function setFilterMyAccounts(enabled: boolean): Promise<void> {
    filterMyAccounts.value = enabled
    await configStore.setFilterMyAccounts(enabled)
  }

  /**
   * 设置会员模式
   */
  async function setMemberMode(enabled: boolean): Promise<void> {
    memberMode.value = enabled
    await configStore.setMemberMode(enabled)
  }

  /**
   * 更新保活配置
   */
  async function updateKeepAliveConfig(config: Partial<Config.KeepAliveConfig>): Promise<void> {
    keepAliveConfig.value = {
      ...keepAliveConfig.value,
      ...config
    }
    await configStore.saveKeepAliveConfig(keepAliveConfig.value)
  }

  /**
   * 更新 UI 配置
   */
  async function updateUIConfig(config: Partial<Config.UIConfig>): Promise<void> {
    uiConfig.value = {
      ...uiConfig.value,
      ...config
    }
    await configStore.saveUIConfig(uiConfig.value)
  }

  /**
   * 更新通知配置
   */
  async function updateNotificationConfig(
    config: Partial<Config.NotificationConfig>
  ): Promise<void> {
    notificationConfig.value = {
      ...notificationConfig.value,
      ...config
    }
    await configStore.saveNotificationConfig(notificationConfig.value)
  }

  /**
   * 设置主题模式
   */
  async function setThemeMode(mode: Config.ThemeMode): Promise<void> {
    await updateUIConfig({ themeMode: mode })
  }

  /**
   * 设置主题颜色
   */
  async function setThemeColor(color: string): Promise<void> {
    await updateUIConfig({ themeColor: color })
  }

  /**
   * 设置卡片密度
   */
  async function setCardDensity(density: Config.CardDensity): Promise<void> {
    await updateUIConfig({ cardDensity: density })
  }

  /**
   * 设置动画开关
   */
  async function setEnableAnimation(enabled: boolean): Promise<void> {
    await updateUIConfig({ enableAnimation: enabled })
  }

  /**
   * 设置比特浏览器连接状态
   */
  function setBitBrowserConnected(connected: boolean): void {
    bitBrowserConnected.value = connected
  }

  /**
   * 重置所有配置到默认值
   */
  async function resetToDefaults(): Promise<void> {
    await setBitBrowserPath('')
    await setBitBrowserApi('http://127.0.0.1:54345')
    await setUsername('')
    await setFilterMyAccounts(true)
    await setMemberMode(false)

    await updateKeepAliveConfig({
      enabled: true,
      checkInterval: 20,
      maxConcurrent: 5,
      retryOnError: true,
      retryInterval: 5,
      notifyOnExpire: true
    })

    await updateUIConfig({
      themeMode: 'auto',
      themeColor: '#18A058',
      cardDensity: 'standard',
      enableAnimation: true
    })

    await updateNotificationConfig({
      cookieExpired: true,
      checkError: true,
      batchComplete: true
    })
  }

  /**
   * 导出所有配置
   */
  async function exportConfig(): Promise<Record<string, any>> {
    return {
      bitBrowserPath: bitBrowserPath.value,
      bitBrowserApi: bitBrowserApi.value,
      username: username.value,
      filterMyAccounts: filterMyAccounts.value,
      memberMode: memberMode.value,
      keepAliveConfig: keepAliveConfig.value,
      uiConfig: uiConfig.value,
      notificationConfig: notificationConfig.value
    }
  }

  /**
   * 导入配置
   */
  async function importConfig(config: Record<string, any>): Promise<void> {
    if (config.bitBrowserPath !== undefined) {
      await setBitBrowserPath(config.bitBrowserPath)
    }

    if (config.bitBrowserApi !== undefined) {
      await setBitBrowserApi(config.bitBrowserApi)
    }

    if (config.username !== undefined) {
      await setUsername(config.username)
    }

    if (config.filterMyAccounts !== undefined) {
      await setFilterMyAccounts(config.filterMyAccounts)
    }

    if (config.memberMode !== undefined) {
      await setMemberMode(config.memberMode)
    }

    if (config.keepAliveConfig) {
      await updateKeepAliveConfig(config.keepAliveConfig)
    }

    if (config.uiConfig) {
      await updateUIConfig(config.uiConfig)
    }

    if (config.notificationConfig) {
      await updateNotificationConfig(config.notificationConfig)
    }
  }

  // ========== 重置状态 ==========

  /**
   * 重置 Store 状态（不影响持久化配置）
   */
  function $reset(): void {
    initialized.value = false
    bitBrowserConnected.value = false
  }

  return {
    // 状态
    bitBrowserPath,
    bitBrowserApi,
    username,
    filterMyAccounts,
    memberMode,
    keepAliveConfig,
    uiConfig,
    notificationConfig,
    initialized,
    bitBrowserConnected,

    // 计算属性
    hasBitBrowserPath,
    hasUsername,
    isConfigured,
    currentThemeMode,
    isDark,

    // Actions
    initialize,
    setBitBrowserPath,
    setBitBrowserApi,
    setUsername,
    setFilterMyAccounts,
    setMemberMode,
    updateKeepAliveConfig,
    updateUIConfig,
    updateNotificationConfig,
    setThemeMode,
    setThemeColor,
    setCardDensity,
    setEnableAnimation,
    setBitBrowserConnected,
    resetToDefaults,
    exportConfig,
    importConfig,

    // 重置
    $reset
  }
})
