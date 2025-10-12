/**
 * BitBrowser API 全局限流器
 * 基于令牌桶算法，支持 VIP/非VIP 模式
 */
import { RateLimiter } from './concurrency';
import { configStore } from './config-store';

/**
 * API 限流器管理类（单例）
 */
class ApiLimiterManager {
  private internalLimiter: RateLimiter | null = null;
  private vipMode: boolean = true;
  private initialized: boolean = false;

  /**
   * 初始化限流器（从配置读取 VIP 模式）
   */
  async init() {
    if (this.initialized) return;

    try {
      // 从配置读取 VIP 模式（默认 true）
      this.vipMode = await configStore.getBitBrowserVipMode() ?? true;

      // 创建内部 API 限流器（BitBrowser API）
      const rate = this.vipMode ? 8 : 2; // VIP: 8req/s, 非VIP: 2req/s
      this.internalLimiter = new RateLimiter(rate, 1000);

      console.log(`[ApiLimiter] 初始化完成 - VIP模式: ${this.vipMode ? '是' : '否'}, 速率: ${rate}req/s`);
      this.initialized = true;
    } catch (error) {
      console.error('[ApiLimiter] 初始化失败:', error);
      // 降级到非 VIP 模式
      this.vipMode = false;
      this.internalLimiter = new RateLimiter(2, 1000);
      this.initialized = true;
    }
  }

  /**
   * 获取内部 API 令牌（BitBrowser API）
   */
  async acquireInternal(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    await this.internalLimiter!.acquire();
  }

  /**
   * 执行内部 API 请求（自动限流）
   */
  async runInternal<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireInternal();
    return fn();
  }

  /**
   * 更新 VIP 模式（动态调整速率）
   */
  async setVipMode(vipMode: boolean) {
    this.vipMode = vipMode;
    await configStore.setBitBrowserVipMode(vipMode);

    // 重新创建限流器
    const rate = vipMode ? 8 : 2;
    this.internalLimiter = new RateLimiter(rate, 1000);

    console.log(`[ApiLimiter] VIP模式已更新: ${vipMode ? '是' : '否'}, 新速率: ${rate}req/s`);
  }

  /**
   * 获取当前 VIP 模式
   */
  getVipMode(): boolean {
    return this.vipMode;
  }

  /**
   * 获取当前速率
   */
  getCurrentRate(): number {
    return this.vipMode ? 8 : 2;
  }
}

// 全局单例实例
export const apiLimiter = new ApiLimiterManager();
