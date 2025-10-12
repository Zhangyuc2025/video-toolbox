/**
 * Throttle 节流
 * 基于 VueUse 的 useThrottleFn
 */
import { useThrottleFn } from '@vueuse/core'

/**
 * 创建节流函数
 *
 * @param fn - 要节流的函数
 * @param ms - 节流时间（毫秒）
 * @param trailing - 是否在结束时执行一次（默认 true）
 * @param leading - 是否在开始时立即执行（默认 true）
 *
 * @example
 * const handleSearch = useThrottle((keyword: string) => {
 *   console.log('搜索:', keyword)
 * }, 500)
 *
 * // 输入时调用，500ms 内只执行一次
 * handleSearch('test')
 */
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  ms: number = 1000,
  trailing: boolean = true,
  leading: boolean = true
) {
  return useThrottleFn(fn, ms, trailing, leading)
}

/**
 * 搜索节流（500ms）
 * 专门用于搜索场景
 */
export function useSearchThrottle<T extends (...args: any[]) => any>(fn: T) {
  return useThrottle(fn, 500)
}

/**
 * 滚动节流（200ms）
 * 专门用于滚动事件
 */
export function useScrollThrottle<T extends (...args: any[]) => any>(fn: T) {
  return useThrottle(fn, 200)
}

/**
 * 窗口调整节流（300ms）
 * 专门用于 resize 事件
 */
export function useResizeThrottle<T extends (...args: any[]) => any>(fn: T) {
  return useThrottle(fn, 300)
}
