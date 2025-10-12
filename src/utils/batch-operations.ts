/**
 * 批量操作工具
 * 基于并发控制实现的常用批量操作
 */
import { runConcurrentSafe, ConcurrentQueue } from './concurrency'
import { services } from '@/services'

/**
 * 批量操作结果
 */
export interface BatchResult<T = any> {
  /** 成功数量 */
  successCount: number
  /** 失败数量 */
  failedCount: number
  /** 总数 */
  total: number
  /** 详细结果 */
  results: Array<{ success: true; data: T } | { success: false; error: Error }>
  /** 成功的数据 */
  successData: T[]
  /** 失败的索引 */
  failedIndices: number[]
}

/**
 * 批量操作配置
 */
export interface BatchOptions {
  /** 并发数（默认 5） */
  concurrency?: number
  /** 进度回调 */
  onProgress?: (completed: number, total: number) => void
  /** 错误回调 */
  onError?: (error: Error, index: number) => void
  /** 遇到错误是否继续（默认 true） */
  continueOnError?: boolean
}

/**
 * 处理批量操作结果
 */
function processBatchResults<T>(
  results: Array<{ success: true; data: T } | { success: false; error: Error }>
): BatchResult<T> {
  const successData: T[] = []
  const failedIndices: number[] = []
  let successCount = 0
  let failedCount = 0

  results.forEach((result, index) => {
    if (result.success) {
      successCount++
      successData.push(result.data)
    } else {
      failedCount++
      failedIndices.push(index)
    }
  })

  return {
    successCount,
    failedCount,
    total: results.length,
    results,
    successData,
    failedIndices
  }
}

// ========== 浏览器批量操作 ==========

/**
 * 批量打开浏览器
 */
export async function batchOpenBrowsers(
  browserIds: string[],
  options?: BatchOptions
): Promise<BatchResult> {
  const { concurrency = 5, onProgress, onError, continueOnError = true } = options || {}

  const results = await runConcurrentSafe(
    browserIds.map(id => () => services.bitBrowser.openBrowser(id)),
    concurrency,
    { onProgress, onError, continueOnError }
  )

  return processBatchResults(results)
}

/**
 * 批量关闭浏览器
 */
export async function batchCloseBrowsers(
  browserIds: string[],
  options?: BatchOptions
): Promise<BatchResult> {
  const { concurrency = 5, onProgress, onError, continueOnError = true } = options || {}

  const results = await runConcurrentSafe(
    browserIds.map(id => () => services.bitBrowser.closeBrowser(id).then(() => true)),
    concurrency,
    { onProgress, onError, continueOnError }
  )

  return processBatchResults(results)
}

/**
 * 批量删除浏览器
 */
export async function batchDeleteBrowsers(
  browserIds: string[],
  options?: BatchOptions
): Promise<BatchResult> {
  const { concurrency = 5, onProgress, onError, continueOnError = true } = options || {}

  const results = await runConcurrentSafe(
    browserIds.map(id => () => services.bitBrowser.deleteBrowsers([id]).then(() => true)),
    concurrency,
    { onProgress, onError, continueOnError }
  )

  return processBatchResults(results)
}

/**
 * 批量重启浏览器
 */
export async function batchRestartBrowsers(
  browserIds: string[],
  options?: BatchOptions & { delay?: number }
): Promise<BatchResult> {
  const { concurrency = 3, delay = 1000, onProgress, onError, continueOnError = true } = options || {}

  const results = await runConcurrentSafe(
    browserIds.map(id => () => services.bitBrowser.restartBrowser(id, delay)),
    concurrency,
    { onProgress, onError, continueOnError }
  )

  return processBatchResults(results)
}

// ========== Cookie 批量操作 ==========

/**
 * 批量同步 Cookie
 */
export async function batchSyncCookies(
  browserIds: string[],
  options?: BatchOptions
): Promise<BatchResult> {
  const { concurrency = 5, onProgress, onError, continueOnError = true } = options || {}

  const results = await runConcurrentSafe(
    browserIds.map(id => () => services.cookie.syncCookieToBrowser(id).then(() => true)),
    concurrency,
    { onProgress, onError, continueOnError }
  )

  return processBatchResults(results)
}

/**
 * 批量检测 Cookie
 */
export async function batchCheckCookies(
  browserIds: string[],
  checkFn: (browserId: string) => Promise<boolean>,
  options?: BatchOptions
): Promise<BatchResult<boolean>> {
  const { concurrency = 5, onProgress, onError, continueOnError = true } = options || {}

  const results = await runConcurrentSafe(
    browserIds.map(id => () => checkFn(id)),
    concurrency,
    { onProgress, onError, continueOnError }
  )

  return processBatchResults(results)
}

/**
 * 批量删除 Cookie
 */
export async function batchDeleteCookies(
  browserIds: string[],
  options?: BatchOptions
): Promise<BatchResult> {
  const { concurrency = 5, onProgress, onError, continueOnError = true } = options || {}

  const results = await runConcurrentSafe(
    browserIds.map(id => () => services.cookie.deleteBrowserCookie(id).then(() => true)),
    concurrency,
    { onProgress, onError, continueOnError }
  )

  return processBatchResults(results)
}

// ========== 通用批量操作 ==========

/**
 * 批量执行任务
 *
 * @example
 * const result = await batchExecute(
 *   userIds,
 *   async (userId) => {
 *     return await fetchUser(userId)
 *   },
 *   {
 *     concurrency: 10,
 *     onProgress: (completed, total) => {
 *       console.log(`进度: ${completed}/${total}`)
 *     }
 *   }
 * )
 */
export async function batchExecute<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options?: BatchOptions
): Promise<BatchResult<R>> {
  const { concurrency = 5, onProgress, onError, continueOnError = true } = options || {}

  const results = await runConcurrentSafe(
    items.map((item, index) => () => fn(item, index)),
    concurrency,
    { onProgress, onError, continueOnError }
  )

  return processBatchResults(results)
}

/**
 * 批量操作队列
 * 支持动态添加任务
 */
export class BatchQueue {
  private queue: ConcurrentQueue
  private results: Array<{ success: boolean; data?: any; error?: Error }> = []
  private onProgressCallback?: (completed: number, total: number) => void

  constructor(concurrency: number = 5) {
    this.queue = new ConcurrentQueue(concurrency)

    this.queue.onProgress((completed, total) => {
      this.onProgressCallback?.(completed, total)
    })
  }

  /**
   * 添加任务
   */
  async add<T>(task: () => Promise<T>): Promise<void> {
    try {
      const data = await this.queue.add(task)
      this.results.push({ success: true, data })
    } catch (error) {
      this.results.push({
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      })
    }
  }

  /**
   * 批量添加任务
   */
  addAll<T>(tasks: Array<() => Promise<T>>): Promise<void[]> {
    return Promise.all(tasks.map(task => this.add(task)))
  }

  /**
   * 等待所有任务完成
   */
  async waitAll(): Promise<BatchResult> {
    await this.queue.waitAll()

    const successData: any[] = []
    const failedIndices: number[] = []
    let successCount = 0
    let failedCount = 0

    this.results.forEach((result, index) => {
      if (result.success) {
        successCount++
        if (result.data !== undefined) {
          successData.push(result.data)
        }
      } else {
        failedCount++
        failedIndices.push(index)
      }
    })

    return {
      successCount,
      failedCount,
      total: this.results.length,
      results: this.results as any,
      successData,
      failedIndices
    }
  }

  /**
   * 设置进度回调
   */
  onProgress(callback: (completed: number, total: number) => void): void {
    this.onProgressCallback = callback
  }

  /**
   * 获取当前统计
   */
  getStats() {
    return this.queue.getStats()
  }

  /**
   * 重置队列
   */
  reset(): void {
    this.queue.reset()
    this.results = []
  }
}

/**
 * 创建批量操作队列
 *
 * @example
 * const queue = createBatchQueue(5)
 *
 * queue.onProgress((completed, total) => {
 *   console.log(`进度: ${completed}/${total}`)
 * })
 *
 * browserIds.forEach(id => {
 *   queue.add(() => services.bitBrowser.openBrowser(id))
 * })
 *
 * const result = await queue.waitAll()
 * console.log(`成功: ${result.successCount}, 失败: ${result.failedCount}`)
 */
export function createBatchQueue(concurrency: number = 5): BatchQueue {
  return new BatchQueue(concurrency)
}
