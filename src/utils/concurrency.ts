/**
 * 并发控制工具
 * 基于 p-limit 实现并发数量限制
 */
import pLimit from 'p-limit'

/**
 * 创建并发限制器
 *
 * @param concurrency - 最大并发数
 * @returns 限制器实例
 *
 * @example
 * const limit = createLimit(5)
 *
 * const tasks = urls.map(url => limit(() => fetch(url)))
 * await Promise.all(tasks)
 */
export function createLimit(concurrency: number) {
  return pLimit(concurrency)
}

/**
 * 并发执行任务（带限制）
 *
 * @param tasks - 任务数组
 * @param concurrency - 最大并发数
 * @param onProgress - 进度回调
 *
 * @example
 * await runConcurrent(
 *   urls.map(url => () => fetch(url)),
 *   5,
 *   (completed, total) => {
 *     console.log(`进度: ${completed}/${total}`)
 *   }
 * )
 */
export async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number = 5,
  onProgress?: (completed: number, total: number) => void
): Promise<T[]> {
  const limit = pLimit(concurrency)
  let completed = 0
  const total = tasks.length

  const wrappedTasks = tasks.map(task =>
    limit(async () => {
      const result = await task()
      completed++
      onProgress?.(completed, total)
      return result
    })
  )

  return Promise.all(wrappedTasks)
}

/**
 * 并发执行任务（带错误处理）
 *
 * @param tasks - 任务数组
 * @param concurrency - 最大并发数
 * @param options - 配置选项
 *
 * @example
 * const results = await runConcurrentSafe(
 *   urls.map(url => () => fetch(url)),
 *   5,
 *   {
 *     onProgress: (completed, total) => console.log(`${completed}/${total}`),
 *     onError: (error, index) => console.error(`任务 ${index} 失败:`, error)
 *   }
 * )
 */
export async function runConcurrentSafe<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number = 5,
  options?: {
    onProgress?: (completed: number, total: number) => void
    onError?: (error: Error, index: number) => void
    continueOnError?: boolean
  }
): Promise<Array<{ success: true; data: T } | { success: false; error: Error }>> {
  const { onProgress, onError, continueOnError = true } = options || {}
  const limit = pLimit(concurrency)
  let completed = 0
  const total = tasks.length

  const wrappedTasks = tasks.map((task, index) =>
    limit(async () => {
      try {
        const result = await task()
        completed++
        onProgress?.(completed, total)
        return { success: true as const, data: result }
      } catch (error) {
        completed++
        const err = error instanceof Error ? error : new Error(String(error))
        onError?.(err, index)
        onProgress?.(completed, total)

        if (continueOnError) {
          return { success: false as const, error: err }
        } else {
          throw err
        }
      }
    })
  )

  return Promise.all(wrappedTasks)
}

/**
 * 批量执行并发任务（分批）
 *
 * @param items - 数据数组
 * @param fn - 处理函数
 * @param batchSize - 每批数量
 * @param concurrency - 每批并发数
 *
 * @example
 * await runBatch(
 *   browserIds,
 *   async (id) => await openBrowser(id),
 *   10,  // 每批 10 个
 *   5    // 每批并发 5 个
 * )
 */
export async function runBatch<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  batchSize: number = 10,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = []

  // 分批处理
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await runConcurrent(
      batch.map((item, index) => () => fn(item, i + index)),
      concurrency
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * 队列执行器
 * 支持动态添加任务到队列
 */
export class ConcurrentQueue<T = any> {
  private limit: ReturnType<typeof pLimit>
  private pendingCount = 0
  private activeCount = 0
  private completedCount = 0
  private results: T[] = []
  private onProgressCallback?: (completed: number, total: number, active: number) => void

  constructor(concurrency: number = 5) {
    this.limit = pLimit(concurrency)
  }

  /**
   * 添加任务到队列
   */
  add(task: () => Promise<T>): Promise<T> {
    this.pendingCount++

    return this.limit(async () => {
      this.pendingCount--
      this.activeCount++
      this.updateProgress()

      try {
        const result = await task()
        this.results.push(result)
        return result
      } finally {
        this.activeCount--
        this.completedCount++
        this.updateProgress()
      }
    })
  }

  /**
   * 批量添加任务
   */
  addAll(tasks: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(tasks.map(task => this.add(task)))
  }

  /**
   * 等待所有任务完成
   */
  async waitAll(): Promise<T[]> {
    await this.limit.clearQueue()
    return this.results
  }

  /**
   * 设置进度回调
   */
  onProgress(callback: (completed: number, total: number, active: number) => void): void {
    this.onProgressCallback = callback
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      pending: this.pendingCount,
      active: this.activeCount,
      completed: this.completedCount,
      total: this.pendingCount + this.activeCount + this.completedCount
    }
  }

  /**
   * 重置队列
   */
  reset(): void {
    this.pendingCount = 0
    this.activeCount = 0
    this.completedCount = 0
    this.results = []
  }

  private updateProgress(): void {
    if (this.onProgressCallback) {
      const stats = this.getStats()
      this.onProgressCallback(stats.completed, stats.total, stats.active)
    }
  }
}

/**
 * 创建并发队列
 *
 * @param concurrency - 最大并发数
 *
 * @example
 * const queue = createQueue(5)
 *
 * queue.onProgress((completed, total) => {
 *   console.log(`进度: ${completed}/${total}`)
 * })
 *
 * urls.forEach(url => {
 *   queue.add(() => fetch(url))
 * })
 *
 * await queue.waitAll()
 */
export function createQueue<T = any>(concurrency: number = 5): ConcurrentQueue<T> {
  return new ConcurrentQueue<T>(concurrency)
}

/**
 * 限流器（Rate Limiter）
 * 限制单位时间内的请求数量
 */
export class RateLimiter {
  private tokens: number
  private maxTokens: number
  private refillRate: number // 每毫秒补充的令牌数
  private lastRefill: number

  constructor(maxRequests: number, perMs: number = 1000) {
    this.maxTokens = maxRequests
    this.tokens = maxRequests
    this.refillRate = maxRequests / perMs
    this.lastRefill = Date.now()
  }

  /**
   * 获取令牌（等待）
   */
  async acquire(): Promise<void> {
    while (true) {
      this.refill()

      if (this.tokens >= 1) {
        this.tokens -= 1
        return
      }

      // 计算需要等待的时间
      const tokensNeeded = 1 - this.tokens
      const waitTime = tokensNeeded / this.refillRate

      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  /**
   * 执行限流任务
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    return fn()
  }

  private refill(): void {
    const now = Date.now()
    const timePassed = now - this.lastRefill
    const tokensToAdd = timePassed * this.refillRate

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
    this.lastRefill = now
  }
}

/**
 * 创建限流器
 *
 * @param maxRequests - 最大请求数
 * @param perMs - 时间窗口（毫秒）
 *
 * @example
 * const limiter = createRateLimiter(10, 1000) // 每秒最多 10 个请求
 *
 * await limiter.run(() => fetch(url))
 */
export function createRateLimiter(maxRequests: number, perMs: number = 1000): RateLimiter {
  return new RateLimiter(maxRequests, perMs)
}
