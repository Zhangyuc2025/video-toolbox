/**
 * Debounce 防抖
 * 基于 VueUse 的 useDebounceFn 和 useDebounce
 */
import { useDebounceFn, useDebounce as vueUseDebounce } from '@vueuse/core'
import { ref, Ref } from 'vue'

/**
 * 创建防抖函数
 *
 * @param fn - 要防抖的函数
 * @param ms - 防抖时间（毫秒）
 * @param options - 配置选项
 *
 * @example
 * const handleInput = useDebounce((value: string) => {
 *   console.log('输入:', value)
 * }, 500)
 *
 * // 连续调用，只在停止输入 500ms 后执行
 * handleInput('a')
 * handleInput('ab')
 * handleInput('abc') // 只有这个会执行
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number = 1000,
  options?: {
    maxWait?: number
  }
) {
  return useDebounceFn(fn, ms, options)
}

/**
 * 创建防抖的响应式值
 *
 * @param value - 响应式值
 * @param ms - 防抖时间（毫秒）
 *
 * @example
 * const keyword = ref('')
 * const debouncedKeyword = useDebouncedRef(keyword, 500)
 *
 * // keyword 变化后，debouncedKeyword 在 500ms 后更新
 * watch(debouncedKeyword, (value) => {
 *   console.log('搜索:', value)
 * })
 */
export function useDebouncedRef<T>(value: Ref<T>, ms: number = 1000): Ref<T> {
  return vueUseDebounce(value, ms)
}

/**
 * 输入防抖（500ms）
 * 专门用于输入场景
 */
export function useInputDebounce<T extends (...args: any[]) => any>(fn: T) {
  return useDebounce(fn, 500)
}

/**
 * 搜索防抖（800ms）
 * 专门用于搜索场景（较长延迟，避免频繁请求）
 */
export function useSearchDebounce<T extends (...args: any[]) => any>(fn: T) {
  return useDebounce(fn, 800)
}

/**
 * 自动保存防抖（2000ms）
 * 专门用于自动保存场景
 */
export function useAutoSaveDebounce<T extends (...args: any[]) => any>(fn: T) {
  return useDebounce(fn, 2000)
}

/**
 * 创建防抖的搜索关键词
 *
 * @example
 * const { keyword, debouncedKeyword } = useDebouncedSearch()
 *
 * watch(debouncedKeyword, async (value) => {
 *   if (value) {
 *     await search(value)
 *   }
 * })
 */
export function useDebouncedSearch(ms: number = 500) {
  const keyword = ref('')
  const debouncedKeyword = useDebouncedRef(keyword, ms)

  return {
    keyword,
    debouncedKeyword
  }
}
