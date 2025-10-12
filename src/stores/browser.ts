/**
 * Browser Store
 * 管理浏览器列表状态
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { services } from '@/services'

export const useBrowserStore = defineStore('browser', () => {
  // ========== 状态 ==========

  /** 浏览器列表 */
  const browsers = ref<Browser.BrowserInfo[]>([])

  /** 加载状态 */
  const loading = ref(false)

  /** 连接状态 */
  const connected = ref(false)

  /** 选中的浏览器 ID 列表 */
  const selectedIds = ref<string[]>([])

  /** 搜索关键词 */
  const searchKeyword = ref('')

  /** 最后更新时间 */
  const lastUpdated = ref<Date | null>(null)

  // ========== 计算属性 ==========

  /** 浏览器总数 */
  const total = computed(() => browsers.value.length)

  /** 运行中的浏览器 */
  const runningBrowsers = computed(() => {
    return browsers.value.filter(b => b.isRunning)
  })

  /** 运行中的数量 */
  const runningCount = computed(() => runningBrowsers.value.length)

  /** 停止的浏览器 */
  const stoppedBrowsers = computed(() => {
    return browsers.value.filter(b => !b.isRunning)
  })

  /** 停止的数量 */
  const stoppedCount = computed(() => stoppedBrowsers.value.length)

  /** 已选中的浏览器 */
  const selectedBrowsers = computed(() => {
    return browsers.value.filter(b => selectedIds.value.includes(b.id))
  })

  /** 选中数量 */
  const selectedCount = computed(() => selectedIds.value.length)

  /** 过滤后的浏览器列表（根据搜索关键词） */
  const filteredBrowsers = computed(() => {
    if (!searchKeyword.value.trim()) {
      return browsers.value
    }

    const keyword = searchKeyword.value.toLowerCase()
    return browsers.value.filter(b => {
      return (
        b.name.toLowerCase().includes(keyword) ||
        b.remark?.toLowerCase().includes(keyword) ||
        b.id.toLowerCase().includes(keyword)
      )
    })
  })

  /** 是否有选中项 */
  const hasSelected = computed(() => selectedIds.value.length > 0)

  /** 是否全选 */
  const isAllSelected = computed(() => {
    return browsers.value.length > 0 && selectedIds.value.length === browsers.value.length
  })

  // ========== Actions ==========

  /**
   * 检查连接状态
   */
  async function checkConnection(): Promise<boolean> {
    try {
      connected.value = await services.bitBrowser.checkConnection()
      return connected.value
    } catch (error) {
      connected.value = false
      return false
    }
  }

  /**
   * 加载浏览器列表
   */
  async function loadBrowsers(showLoading = true): Promise<boolean> {
    if (showLoading) {
      loading.value = true
    }

    try {
      browsers.value = await services.bitBrowser.getBrowserList()
      lastUpdated.value = new Date()

      // 同步到 Rust State 缓存
      await services.state.updateBrowserCache(browsers.value)

      return true
    } catch (error) {
      console.error('加载浏览器列表失败:', error)
      return false
    } finally {
      if (showLoading) {
        loading.value = false
      }
    }
  }

  /**
   * 从缓存加载浏览器列表
   */
  async function loadFromCache(): Promise<void> {
    const cached = await services.state.getCachedBrowserList()
    if (cached && cached.length > 0) {
      browsers.value = cached
      lastUpdated.value = new Date()
    }
  }

  /**
   * 刷新列表
   */
  async function refresh(): Promise<boolean> {
    return loadBrowsers(true)
  }

  /**
   * 根据 ID 查找浏览器
   */
  function findById(id: string): Browser.BrowserInfo | undefined {
    return browsers.value.find(b => b.id === id)
  }

  /**
   * 根据名称查找浏览器
   */
  function findByName(name: string): Browser.BrowserInfo | undefined {
    return browsers.value.find(b => b.name === name)
  }

  /**
   * 打开浏览器
   */
  async function openBrowser(id: string): Promise<boolean> {
    const result = await services.bitBrowser.openBrowser(id)

    if (result) {
      // 更新本地状态
      const browser = findById(id)
      if (browser) {
        browser.isRunning = true
      }
    }

    return result !== null
  }

  /**
   * 关闭浏览器
   */
  async function closeBrowser(id: string): Promise<boolean> {
    const result = await services.bitBrowser.closeBrowser(id)

    if (result) {
      // 更新本地状态
      const browser = findById(id)
      if (browser) {
        browser.isRunning = false
      }
    }

    return result
  }

  /**
   * 删除浏览器
   */
  async function deleteBrowser(id: string): Promise<boolean> {
    const result = await services.bitBrowser.deleteBrowsers([id])

    if (result) {
      // 从列表中移除
      const index = browsers.value.findIndex(b => b.id === id)
      if (index !== -1) {
        browsers.value.splice(index, 1)
      }

      // 从选中列表移除
      removeFromSelection(id)
    }

    return result
  }

  /**
   * 批量打开浏览器
   */
  async function batchOpen(ids?: string[]): Promise<void> {
    const targetIds = ids || selectedIds.value
    if (targetIds.length === 0) return

    await services.bitBrowser.batchOpenBrowsers(targetIds)
    await loadBrowsers(false)
  }

  /**
   * 批量关闭浏览器
   */
  async function batchClose(ids?: string[]): Promise<void> {
    const targetIds = ids || selectedIds.value
    if (targetIds.length === 0) return

    await services.bitBrowser.batchCloseBrowsers(targetIds)
    await loadBrowsers(false)
  }

  /**
   * 批量删除浏览器
   */
  async function batchDelete(ids?: string[]): Promise<void> {
    const targetIds = ids || selectedIds.value
    if (targetIds.length === 0) return

    const result = await services.bitBrowser.batchDeleteBrowsers(targetIds)

    if (result) {
      // 从列表中移除
      browsers.value = browsers.value.filter(b => !targetIds.includes(b.id))

      // 清空选中
      if (!ids) {
        clearSelection()
      }
    }
  }

  /**
   * 切换浏览器状态
   */
  async function toggleBrowser(id: string): Promise<boolean> {
    const browser = findById(id)
    if (!browser) return false

    if (browser.isRunning) {
      return closeBrowser(id)
    } else {
      return openBrowser(id)
    }
  }

  /**
   * 重启浏览器
   */
  async function restartBrowser(id: string): Promise<boolean> {
    const result = await services.bitBrowser.restartBrowser(id)

    if (result) {
      await loadBrowsers(false)
    }

    return result
  }

  // ========== 选择操作 ==========

  /**
   * 选中浏览器
   */
  function select(id: string): void {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id)
    }
  }

  /**
   * 取消选中浏览器
   */
  function unselect(id: string): void {
    const index = selectedIds.value.indexOf(id)
    if (index !== -1) {
      selectedIds.value.splice(index, 1)
    }
  }

  /**
   * 切换选中状态
   */
  function toggleSelection(id: string): void {
    if (selectedIds.value.includes(id)) {
      unselect(id)
    } else {
      select(id)
    }
  }

  /**
   * 全选
   */
  function selectAll(): void {
    selectedIds.value = browsers.value.map(b => b.id)
  }

  /**
   * 取消全选
   */
  function clearSelection(): void {
    selectedIds.value = []
  }

  /**
   * 反选
   */
  function invertSelection(): void {
    const allIds = browsers.value.map(b => b.id)
    selectedIds.value = allIds.filter(id => !selectedIds.value.includes(id))
  }

  /**
   * 选中运行中的浏览器
   */
  function selectRunning(): void {
    selectedIds.value = runningBrowsers.value.map(b => b.id)
  }

  /**
   * 选中停止的浏览器
   */
  function selectStopped(): void {
    selectedIds.value = stoppedBrowsers.value.map(b => b.id)
  }

  /**
   * 从选中列表移除
   */
  function removeFromSelection(id: string): void {
    unselect(id)
  }

  // ========== 搜索操作 ==========

  /**
   * 设置搜索关键词
   */
  function setSearchKeyword(keyword: string): void {
    searchKeyword.value = keyword
  }

  /**
   * 清空搜索
   */
  function clearSearch(): void {
    searchKeyword.value = ''
  }

  // ========== 重置状态 ==========

  /**
   * 重置所有状态
   */
  function $reset(): void {
    browsers.value = []
    loading.value = false
    connected.value = false
    selectedIds.value = []
    searchKeyword.value = ''
    lastUpdated.value = null
  }

  return {
    // 状态
    browsers,
    loading,
    connected,
    selectedIds,
    searchKeyword,
    lastUpdated,

    // 计算属性
    total,
    runningBrowsers,
    runningCount,
    stoppedBrowsers,
    stoppedCount,
    selectedBrowsers,
    selectedCount,
    filteredBrowsers,
    hasSelected,
    isAllSelected,

    // Actions
    checkConnection,
    loadBrowsers,
    loadFromCache,
    refresh,
    findById,
    findByName,
    openBrowser,
    closeBrowser,
    deleteBrowser,
    batchOpen,
    batchClose,
    batchDelete,
    toggleBrowser,
    restartBrowser,

    // 选择操作
    select,
    unselect,
    toggleSelection,
    selectAll,
    clearSelection,
    invertSelection,
    selectRunning,
    selectStopped,
    removeFromSelection,

    // 搜索操作
    setSearchKeyword,
    clearSearch,

    // 重置
    $reset
  }
})
