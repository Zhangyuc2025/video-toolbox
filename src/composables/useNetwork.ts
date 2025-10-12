/**
 * 网络状态工具
 * 基于 VueUse 的 useNetwork 和 useOnline
 */
import { useNetwork, useOnline } from '@vueuse/core'

/**
 * 网络在线状态
 *
 * @example
 * const { isOnline } = useNetworkStatus()
 *
 * watch(isOnline, (online) => {
 *   if (!online) {
 *     window.$message?.warning('网络已断开')
 *   }
 * })
 */
export function useNetworkStatus() {
  const isOnline = useOnline()
  const network = useNetwork()

  return {
    isOnline,
    isOffline: computed(() => !isOnline.value),
    network
  }
}

/**
 * 网络状态监听（带提示）
 *
 * @example
 * useNetworkMonitor()
 */
export function useNetworkMonitor() {
  const { isOnline } = useNetworkStatus()

  watch(isOnline, (online, wasOnline) => {
    if (typeof window === 'undefined') return

    if (!online && wasOnline !== undefined) {
      window.$message?.warning('网络已断开')
    } else if (online && wasOnline === false) {
      window.$message?.success('网络已恢复')
    }
  })

  return {
    isOnline
  }
}

import { computed, watch } from 'vue'
