/**
 * 工具函数统一导出
 */

// 通知工具
export { message, notification, dialog, loadingBar } from './notification'
export { default as notify } from './notification'

// 配置存储
export { configStore, ConfigStore } from './config-store'

// 并发控制
export {
  createLimit,
  runConcurrent,
  runConcurrentSafe,
  runBatch,
  createQueue,
  createRateLimiter,
  ConcurrentQueue,
  RateLimiter
} from './concurrency'

// 批量操作
export {
  batchOpenBrowsers,
  batchCloseBrowsers,
  batchDeleteBrowsers,
  batchRestartBrowsers,
  batchSyncCookies,
  batchCheckCookies,
  batchDeleteCookies,
  batchExecute,
  createBatchQueue,
  BatchQueue
} from './batch-operations'

export type { BatchResult, BatchOptions } from './batch-operations'

// 重新导入用于 utils 对象
import { configStore } from './config-store'
import {
  createLimit,
  runConcurrent,
  runConcurrentSafe,
  runBatch,
  createQueue,
  createRateLimiter
} from './concurrency'
import {
  batchOpenBrowsers,
  batchCloseBrowsers,
  batchDeleteBrowsers,
  batchRestartBrowsers,
  batchSyncCookies,
  batchCheckCookies,
  batchDeleteCookies,
  batchExecute,
  createBatchQueue
} from './batch-operations'

// 统一访问入口
export const utils = {
  // 配置
  config: configStore,

  // 并发控制
  concurrency: {
    createLimit,
    runConcurrent,
    runConcurrentSafe,
    runBatch,
    createQueue,
    createRateLimiter
  },

  // 批量操作
  batch: {
    openBrowsers: batchOpenBrowsers,
    closeBrowsers: batchCloseBrowsers,
    deleteBrowsers: batchDeleteBrowsers,
    restartBrowsers: batchRestartBrowsers,
    syncCookies: batchSyncCookies,
    checkCookies: batchCheckCookies,
    deleteCookies: batchDeleteCookies,
    execute: batchExecute,
    createQueue: createBatchQueue
  }
}
