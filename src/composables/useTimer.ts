/**
 * 计时器工具
 * 基于 VueUse 的 useInterval 和 useTimeout
 */
import { useIntervalFn, useTimeoutFn } from '@vueuse/core'
import { ref } from 'vue'

/**
 * 定时器（Interval）
 *
 * @param callback - 回调函数
 * @param interval - 间隔时间（毫秒）
 * @param options - 配置选项
 *
 * @example
 * const { pause, resume, isActive } = useTimer(() => {
 *   console.log('每秒执行一次')
 * }, 1000)
 *
 * pause() // 暂停
 * resume() // 恢复
 */
export function useTimer(
  callback: () => void,
  interval: number,
  options?: {
    immediate?: boolean
    immediateCallback?: boolean
  }
) {
  const { pause, resume, isActive } = useIntervalFn(
    callback,
    interval,
    options
  )

  return {
    pause,
    resume,
    isActive
  }
}

/**
 * 延时执行（Timeout）
 *
 * @param callback - 回调函数
 * @param delay - 延时时间（毫秒）
 *
 * @example
 * const { start, stop, isPending } = useDelay(() => {
 *   console.log('3秒后执行')
 * }, 3000)
 *
 * start() // 开始计时
 * stop() // 取消
 */
export function useDelay(
  callback: () => void,
  delay: number
) {
  const { start, stop, isPending } = useTimeoutFn(callback, delay, { immediate: false })

  return {
    start,
    stop,
    isPending
  }
}

/**
 * 倒计时
 *
 * @param seconds - 倒计时秒数
 * @param onFinish - 完成回调
 *
 * @example
 * const { count, start, pause, resume, reset } = useCountdown(60, () => {
 *   console.log('倒计时结束')
 * })
 *
 * start() // 开始倒计时
 */
export function useCountdown(
  seconds: number,
  onFinish?: () => void
) {
  const count = ref(seconds)
  const isActive = ref(false)

  const { pause, resume } = useIntervalFn(
    () => {
      if (count.value > 0) {
        count.value--
      } else {
        pause()
        isActive.value = false
        onFinish?.()
      }
    },
    1000,
    { immediate: false }
  )

  function start() {
    count.value = seconds
    isActive.value = true
    resume()
  }

  function reset() {
    count.value = seconds
    pause()
    isActive.value = false
  }

  return {
    count,
    isActive,
    start,
    pause,
    resume,
    reset
  }
}

/**
 * 计时器（正向计时）
 *
 * @example
 * const { elapsed, start, pause, resume, reset } = useStopwatch()
 *
 * start() // 开始计时
 * console.log(elapsed.value) // 已过时间（秒）
 */
export function useStopwatch() {
  const elapsed = ref(0)
  const isActive = ref(false)

  const { pause, resume } = useIntervalFn(
    () => {
      elapsed.value++
    },
    1000,
    { immediate: false }
  )

  function start() {
    elapsed.value = 0
    isActive.value = true
    resume()
  }

  function reset() {
    elapsed.value = 0
    pause()
    isActive.value = false
  }

  return {
    elapsed,
    isActive,
    start,
    pause,
    resume,
    reset
  }
}

/**
 * 格式化秒数为时分秒
 *
 * @param seconds - 秒数
 * @returns 格式化的时间字符串（HH:MM:SS 或 MM:SS）
 *
 * @example
 * formatTime(125) // '02:05'
 * formatTime(3665) // '01:01:05'
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts: string[] = []

  if (hours > 0) {
    parts.push(hours.toString().padStart(2, '0'))
  }

  parts.push(minutes.toString().padStart(2, '0'))
  parts.push(secs.toString().padStart(2, '0'))

  return parts.join(':')
}
