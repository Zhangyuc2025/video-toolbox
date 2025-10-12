/**
 * Proxy Store
 * 管理代理配置状态
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { services } from '@/services'

export const useProxyStore = defineStore('proxy', () => {
  // ========== 状态 ==========

  /** 代理列表 */
  const proxies = ref<Proxy.ProxyInfo[]>([])

  /** 加载状态 */
  const loading = ref(false)

  /** 选中的代理索引列表 */
  const selectedIndices = ref<number[]>([])

  /** 最后更新时间 */
  const lastUpdated = ref<Date | null>(null)

  // ========== 计算属性 ==========

  /** 代理总数 */
  const total = computed(() => proxies.value.length)

  /** 可用的代理 */
  const availableProxies = computed(() => {
    return proxies.value.filter(p => p.status === 'normal')
  })

  /** 可用数量 */
  const availableCount = computed(() => availableProxies.value.length)

  /** 失败的代理 */
  const failedProxies = computed(() => {
    return proxies.value.filter(p => p.status === 'failed')
  })

  /** 失败数量 */
  const failedCount = computed(() => failedProxies.value.length)

  /** 已选中的代理 */
  const selectedProxies = computed(() => {
    return selectedIndices.value.map(i => proxies.value[i]).filter(Boolean)
  })

  /** 选中数量 */
  const selectedCount = computed(() => selectedIndices.value.length)

  /** 是否有选中项 */
  const hasSelected = computed(() => selectedIndices.value.length > 0)

  /** 按类型分组的代理 */
  const proxyGroups = computed(() => {
    const groups: Record<Proxy.ProxyType, Proxy.ProxyInfo[]> = {
      http: [],
      https: [],
      socks5: []
    }

    proxies.value.forEach(p => {
      groups[p.type].push(p)
    })

    return groups
  })

  // ========== Actions ==========

  /**
   * 加载代理列表
   */
  async function loadProxies(): Promise<void> {
    loading.value = true

    try {
      proxies.value = await services.proxy.getProxies()
      lastUpdated.value = new Date()
    } catch (error) {
      console.error('加载代理列表失败:', error)
    } finally {
      loading.value = false
    }
  }

  /**
   * 添加代理
   */
  async function addProxy(proxy: Omit<Proxy.ProxyInfo, 'id' | 'createdAt'>): Promise<boolean> {
    const success = await services.proxy.addProxy(proxy)

    if (success) {
      await loadProxies()
    }

    return success
  }

  /**
   * 更新代理
   */
  async function updateProxy(index: number, proxy: Proxy.ProxyInfo): Promise<boolean> {
    const success = await services.proxy.updateProxy(index, proxy)

    if (success) {
      proxies.value[index] = proxy
      lastUpdated.value = new Date()
    }

    return success
  }

  /**
   * 删除代理
   */
  async function deleteProxy(index: number): Promise<boolean> {
    const success = await services.proxy.deleteProxy(index)

    if (success) {
      proxies.value.splice(index, 1)
      lastUpdated.value = new Date()

      // 从选中列表移除
      removeFromSelection(index)
    }

    return success
  }

  /**
   * 批量删除代理
   */
  async function batchDelete(indices?: number[]): Promise<boolean> {
    const targetIndices = indices || selectedIndices.value
    if (targetIndices.length === 0) return false

    const success = await services.proxy.batchDeleteProxies(targetIndices)

    if (success) {
      await loadProxies()

      // 清空选中
      if (!indices) {
        clearSelection()
      }
    }

    return success
  }

  /**
   * 根据 ID 查找代理
   */
  async function findById(id: string): Promise<{ proxy: Proxy.ProxyInfo; index: number } | null> {
    return services.proxy.findProxyById(id)
  }

  /**
   * 更新代理状态
   */
  async function updateStatus(index: number, status: Proxy.ProxyStatus): Promise<boolean> {
    const success = await services.proxy.updateProxyStatus(index, status)

    if (success) {
      proxies.value[index].status = status
      lastUpdated.value = new Date()
    }

    return success
  }

  /**
   * 更新代理统计
   */
  async function updateStats(index: number, stats: Partial<Proxy.ProxyStats>): Promise<boolean> {
    const success = await services.proxy.updateProxyStats(index, stats)

    if (success) {
      if (!proxies.value[index].stats) {
        proxies.value[index].stats = {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0
        }
      }

      Object.assign(proxies.value[index].stats!, stats)
      lastUpdated.value = new Date()
    }

    return success
  }

  /**
   * 增加代理使用次数
   */
  async function incrementUsage(index: number, success: boolean): Promise<boolean> {
    const result = await services.proxy.incrementProxyUsage(index, success)

    if (result) {
      await loadProxies()
    }

    return result
  }

  /**
   * 获取随机代理
   */
  async function getRandomProxy(): Promise<Proxy.ProxyInfo | null> {
    return services.proxy.getRandomProxy()
  }

  /**
   * 批量导入代理
   */
  async function batchImport(proxyStrings: string[]): Promise<number> {
    const count = await services.proxy.batchImportProxies(proxyStrings)

    if (count > 0) {
      await loadProxies()
    }

    return count
  }

  /**
   * 导出代理
   */
  async function exportProxies(): Promise<string[]> {
    return services.proxy.exportProxies()
  }

  /**
   * 格式化代理为字符串
   */
  function formatProxy(proxy: Proxy.ProxyInfo): string {
    return services.proxy.formatProxyString(proxy)
  }

  /**
   * 从字符串解析代理
   */
  function parseProxy(proxyString: string): Omit<Proxy.ProxyInfo, 'id' | 'createdAt' | 'status'> | null {
    return services.proxy.parseProxyString(proxyString)
  }

  /**
   * 刷新代理列表
   */
  async function refresh(): Promise<void> {
    await loadProxies()
  }

  // ========== 选择操作 ==========

  /**
   * 选中代理
   */
  function select(index: number): void {
    if (!selectedIndices.value.includes(index)) {
      selectedIndices.value.push(index)
    }
  }

  /**
   * 取消选中代理
   */
  function unselect(index: number): void {
    const idx = selectedIndices.value.indexOf(index)
    if (idx !== -1) {
      selectedIndices.value.splice(idx, 1)
    }
  }

  /**
   * 切换选中状态
   */
  function toggleSelection(index: number): void {
    if (selectedIndices.value.includes(index)) {
      unselect(index)
    } else {
      select(index)
    }
  }

  /**
   * 全选
   */
  function selectAll(): void {
    selectedIndices.value = proxies.value.map((_, i) => i)
  }

  /**
   * 取消全选
   */
  function clearSelection(): void {
    selectedIndices.value = []
  }

  /**
   * 反选
   */
  function invertSelection(): void {
    const allIndices = proxies.value.map((_, i) => i)
    selectedIndices.value = allIndices.filter(i => !selectedIndices.value.includes(i))
  }

  /**
   * 选中可用的代理
   */
  function selectAvailable(): void {
    selectedIndices.value = proxies.value
      .map((p, i) => (p.status === 'normal' ? i : -1))
      .filter(i => i !== -1)
  }

  /**
   * 选中失败的代理
   */
  function selectFailed(): void {
    selectedIndices.value = proxies.value
      .map((p, i) => (p.status === 'failed' ? i : -1))
      .filter(i => i !== -1)
  }

  /**
   * 从选中列表移除
   */
  function removeFromSelection(index: number): void {
    unselect(index)
  }

  // ========== 筛选和查询 ==========

  /**
   * 按类型获取代理
   */
  function getByType(type: Proxy.ProxyType): Proxy.ProxyInfo[] {
    return proxies.value.filter(p => p.type === type)
  }

  /**
   * 按状态获取代理
   */
  function getByStatus(status: Proxy.ProxyStatus): Proxy.ProxyInfo[] {
    return proxies.value.filter(p => p.status === status)
  }

  /**
   * 获取指定索引的代理
   */
  function getByIndex(index: number): Proxy.ProxyInfo | undefined {
    return proxies.value[index]
  }

  // ========== 重置状态 ==========

  /**
   * 重置所有状态
   */
  function $reset(): void {
    proxies.value = []
    loading.value = false
    selectedIndices.value = []
    lastUpdated.value = null
  }

  return {
    // 状态
    proxies,
    loading,
    selectedIndices,
    lastUpdated,

    // 计算属性
    total,
    availableProxies,
    availableCount,
    failedProxies,
    failedCount,
    selectedProxies,
    selectedCount,
    hasSelected,
    proxyGroups,

    // Actions
    loadProxies,
    addProxy,
    updateProxy,
    deleteProxy,
    batchDelete,
    findById,
    updateStatus,
    updateStats,
    incrementUsage,
    getRandomProxy,
    batchImport,
    exportProxies,
    formatProxy,
    parseProxy,
    refresh,

    // 选择操作
    select,
    unselect,
    toggleSelection,
    selectAll,
    clearSelection,
    invertSelection,
    selectAvailable,
    selectFailed,
    removeFromSelection,

    // 筛选和查询
    getByType,
    getByStatus,
    getByIndex,

    // 重置
    $reset
  }
})
