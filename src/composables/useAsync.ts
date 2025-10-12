/**
 * 异步请求工具
 * 基于 VueUse 的 useAsyncState
 */
import { useAsyncState } from '@vueuse/core'
import { ref } from 'vue'

/**
 * 异步请求状态管理
 *
 * @param promise - 异步函数
 * @param initialState - 初始状态
 * @param options - 配置选项
 *
 * @example
 * const { state, isLoading, error, execute } = useRequest(
 *   async () => {
 *     const data = await fetchData()
 *     return data
 *   },
 *   []
 * )
 *
 * // 手动执行
 * await execute()
 */
export function useRequest<T>(
  promise: () => Promise<T>,
  initialState: T,
  options?: {
    immediate?: boolean
    resetOnExecute?: boolean
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
  }
) {
  const { immediate = true, resetOnExecute = true, onSuccess, onError } = options || {}

  const { state, isReady, isLoading, error, execute } = useAsyncState(
    promise,
    initialState,
    {
      immediate,
      resetOnExecute,
      onSuccess,
      onError
    }
  )

  return {
    data: state,
    isReady,
    isLoading,
    error,
    execute
  }
}

/**
 * 加载状态管理
 *
 * @example
 * const { loading, startLoading, stopLoading, withLoading } = useLoading()
 *
 * // 方式1: 手动控制
 * startLoading()
 * await doSomething()
 * stopLoading()
 *
 * // 方式2: 自动包装
 * await withLoading(async () => {
 *   await doSomething()
 * })
 */
export function useLoading(initialValue: boolean = false) {
  const loading = ref(initialValue)

  function startLoading() {
    loading.value = true
  }

  function stopLoading() {
    loading.value = false
  }

  function setLoading(value: boolean) {
    loading.value = value
  }

  async function withLoading<T>(fn: () => Promise<T>): Promise<T> {
    try {
      startLoading()
      return await fn()
    } finally {
      stopLoading()
    }
  }

  return {
    loading,
    startLoading,
    stopLoading,
    setLoading,
    withLoading
  }
}

/**
 * 错误处理
 *
 * @example
 * const { error, setError, clearError, hasError } = useError()
 *
 * try {
 *   await doSomething()
 * } catch (e) {
 *   setError(e)
 * }
 *
 * if (hasError.value) {
 *   console.error(error.value)
 * }
 */
export function useError() {
  const error = ref<Error | null>(null)

  function setError(err: Error | string) {
    error.value = err instanceof Error ? err : new Error(err)
  }

  function clearError() {
    error.value = null
  }

  const hasError = computed(() => error.value !== null)

  return {
    error,
    setError,
    clearError,
    hasError
  }
}

/**
 * 组合加载和错误状态
 *
 * @example
 * const { loading, error, execute } = useAsyncOperation(async () => {
 *   const data = await fetchData()
 *   return data
 * })
 *
 * await execute()
 */
export function useAsyncOperation<T>(
  fn: () => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
  }
) {
  const { loading, withLoading } = useLoading()
  const { error, setError, clearError } = useError()

  async function execute(): Promise<T | undefined> {
    clearError()

    return withLoading(async () => {
      try {
        const result = await fn()
        options?.onSuccess?.(result)
        return result
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        setError(err)
        options?.onError?.(err)
        throw err
      }
    })
  }

  return {
    loading,
    error,
    execute
  }
}

import { computed } from 'vue'
