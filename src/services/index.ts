/**
 * Services 统一导出
 * 使用依赖注入容器管理服务，解决循环依赖问题
 */

import { container } from './container'
import { BitBrowserService } from './bitbrowser'
import { StateService } from './state'
import { CookieService } from './cookie'
import { ProxyService } from './proxy'

// ==================== 导出类型 ====================

export { BaseService } from './base'
export type { ApiResponse, ServiceConfig } from './base'

export { BitBrowserService } from './bitbrowser'
export type { CreateBrowserParams, UpdateBrowserParams, SyncCookiesParams } from './bitbrowser'

export { StateService } from './state'

export { CookieService } from './cookie'
export type { CookieValidationResult } from './cookie'

export { ProxyService } from './proxy'

export { container } from './container'

// ==================== 注册服务到容器 ====================

// 注册 BitBrowser 服务（无依赖，最先注册）
container.register('bitBrowser', () => {
  return new BitBrowserService({
    showSuccessMessage: true,
    showErrorMessage: true,
    enableLogging: true
  })
})

// 注册 State 服务（无依赖）
container.register('state', () => {
  return new StateService({
    showSuccessMessage: false,
    showErrorMessage: true,
    enableLogging: true
  })
})

// 注册 Proxy 服务（无依赖）
container.register('proxy', () => {
  return new ProxyService({
    showSuccessMessage: true,
    showErrorMessage: true,
    enableLogging: true
  })
})

// 注册 Cookie 服务（依赖 BitBrowserService 和 StateService，但通过容器获取）
container.register('cookie', () => {
  return new CookieService({
    showSuccessMessage: true,
    showErrorMessage: true,
    enableLogging: true
  })
})

// ==================== 导出服务实例 ====================

// 通过容器获取服务实例（延迟初始化，避免循环依赖）
export const bitBrowserService = container.get<BitBrowserService>('bitBrowser')
export const stateService = container.get<StateService>('state')
export const cookieService = container.get<CookieService>('cookie')
export const proxyService = container.get<ProxyService>('proxy')

// 统一导出所有服务实例
export const services = {
  bitBrowser: bitBrowserService,
  state: stateService,
  cookie: cookieService,
  proxy: proxyService
}

// 默认导出
export default services
