/**
 * Composables 统一导出
 * 基于 VueUse 的工具函数集合
 */

// 导入所有函数以便在 composables 对象中使用
import {
  useThrottle,
  useSearchThrottle,
  useScrollThrottle,
  useResizeThrottle
} from './useThrottle'

import {
  useDebounce,
  useDebouncedRef,
  useInputDebounce,
  useSearchDebounce,
  useAutoSaveDebounce,
  useDebouncedSearch
} from './useDebounce'

import {
  useLocal,
  useSession,
  useStore,
  useRecentList,
  usePreferences
} from './useStorage'

import {
  useNetworkStatus,
  useNetworkMonitor
} from './useNetwork'

import {
  useClipboard,
  copyToClipboard
} from './useClipboard'

import {
  useTimer,
  useDelay,
  useCountdown,
  useStopwatch,
  formatTime
} from './useTimer'

import {
  useWindow,
  useScroll,
  useFocus,
  useElementDimensions,
  useVisible,
  useBreakpoint
} from './useWindow'

import {
  useRequest,
  useLoading,
  useError,
  useAsyncOperation
} from './useAsync'

// 重新导出所有函数
export {
  // 节流
  useThrottle,
  useSearchThrottle,
  useScrollThrottle,
  useResizeThrottle,
  // 防抖
  useDebounce,
  useDebouncedRef,
  useInputDebounce,
  useSearchDebounce,
  useAutoSaveDebounce,
  useDebouncedSearch,
  // 存储
  useLocal,
  useSession,
  useStore,
  useRecentList,
  usePreferences,
  // 网络
  useNetworkStatus,
  useNetworkMonitor,
  // 剪贴板
  useClipboard,
  copyToClipboard,
  // 计时器
  useTimer,
  useDelay,
  useCountdown,
  useStopwatch,
  formatTime,
  // 窗口
  useWindow,
  useScroll,
  useFocus,
  useElementDimensions,
  useVisible,
  useBreakpoint,
  // 异步
  useRequest,
  useLoading,
  useError,
  useAsyncOperation
}

// 常用工具组合
export const composables = {
  // 节流防抖
  throttle: {
    useThrottle,
    useSearchThrottle,
    useScrollThrottle,
    useResizeThrottle
  },
  debounce: {
    useDebounce,
    useDebouncedRef,
    useInputDebounce,
    useSearchDebounce,
    useAutoSaveDebounce,
    useDebouncedSearch
  },

  // 存储
  storage: {
    useLocal,
    useSession,
    useStore,
    useRecentList,
    usePreferences
  },

  // 浏览器 API
  browser: {
    useNetworkStatus,
    useNetworkMonitor,
    useClipboard,
    copyToClipboard
  },

  // 计时
  timer: {
    useTimer,
    useDelay,
    useCountdown,
    useStopwatch,
    formatTime
  },

  // 窗口和元素
  window: {
    useWindow,
    useScroll,
    useFocus,
    useElementDimensions,
    useVisible,
    useBreakpoint
  },

  // 异步
  async: {
    useRequest,
    useLoading,
    useError,
    useAsyncOperation
  }
}

// 辅助工具（从 hooks 迁移）
export * from './useRouterHelper'
export * from './useIconHelper'
export * from './useFormHelper'
export * from './useTableHelper'
export * from './useEcharts'

// 账号管理
export { useAddAccount } from './useAddAccount'
