/**
 * Stores 统一导出
 */

// 导出所有 Store
export { useBrowserStore } from './browser'
export { useCookieStore } from './cookie'
export { useProxyStore } from './proxy'
export { useAppStore } from './app'

// 统一访问入口
import { useBrowserStore } from './browser'
import { useCookieStore } from './cookie'
import { useProxyStore } from './proxy'
import { useAppStore } from './app'

/**
 * 获取所有 Store 实例
 *
 * 使用方式：
 * const stores = useStores()
 * stores.browser.loadBrowsers()
 * stores.cookie.loadCookies()
 */
export function useStores() {
  return {
    browser: useBrowserStore(),
    cookie: useCookieStore(),
    proxy: useProxyStore(),
    app: useAppStore()
  }
}

/**
 * 重置所有 Store
 */
export function resetAllStores(): void {
  const browser = useBrowserStore()
  const cookie = useCookieStore()
  const proxy = useProxyStore()
  const app = useAppStore()

  browser.$reset()
  cookie.$reset()
  proxy.$reset()
  app.$reset()
}

/**
 * 初始化所有 Store
 */
export async function initializeStores(): Promise<void> {
  const app = useAppStore()
  const browser = useBrowserStore()
  const cookie = useCookieStore()
  const proxy = useProxyStore()

  // 1. 初始化应用配置
  await app.initialize()

  // 2. 检查比特浏览器连接
  const connected = await browser.checkConnection()
  app.setBitBrowserConnected(connected)

  if (connected) {
    // 3. 加载数据（优先从缓存加载，提高启动速度）
    await Promise.all([
      browser.loadFromCache(),
      cookie.loadCookies(),
      proxy.loadProxies()
    ])

    // 4. 后台刷新数据
    setTimeout(() => {
      browser.loadBrowsers(false)
    }, 1000)
  }
}

/**
 * 刷新所有数据
 */
export async function refreshAllData(): Promise<void> {
  const browser = useBrowserStore()
  const cookie = useCookieStore()
  const proxy = useProxyStore()

  await Promise.all([browser.refresh(), cookie.refresh(), proxy.refresh()])
}
