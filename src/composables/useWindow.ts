/**
 * 窗口和元素工具
 * 基于 VueUse 的窗口相关工具
 */
import {
  useWindowSize,
  useWindowScroll,
  useWindowFocus,
  useElementSize,
  useElementVisibility
} from '@vueuse/core'
import { Ref, computed } from 'vue'

/**
 * 窗口尺寸
 *
 * @example
 * const { width, height, isMobile, isTablet, isDesktop } = useWindow()
 *
 * console.log(width.value) // 窗口宽度
 * console.log(isMobile.value) // 是否移动端
 */
export function useWindow() {
  const { width, height } = useWindowSize()

  const isMobile = computed(() => width.value < 768)
  const isTablet = computed(() => width.value >= 768 && width.value < 1024)
  const isDesktop = computed(() => width.value >= 1024)

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop
  }
}

/**
 * 窗口滚动位置
 *
 * @example
 * const { x, y, isScrolling } = useScroll()
 *
 * watch(y, (scrollY) => {
 *   if (scrollY > 100) {
 *     console.log('已滚动超过 100px')
 *   }
 * })
 */
export function useScroll() {
  const { x, y } = useWindowScroll()

  // 简单的滚动检测
  const isScrolling = computed(() => y.value > 0)

  return {
    x,
    y,
    isScrolling
  }
}

/**
 * 窗口焦点状态
 *
 * @example
 * const { focused } = useFocus()
 *
 * watch(focused, (isFocused) => {
 *   if (!isFocused) {
 *     console.log('窗口失去焦点')
 *   }
 * })
 */
export function useFocus() {
  const focused = useWindowFocus()

  return {
    focused,
    blurred: computed(() => !focused.value)
  }
}

/**
 * 元素尺寸
 *
 * @param target - 目标元素 ref
 *
 * @example
 * const elementRef = ref<HTMLElement>()
 * const { width, height } = useElementDimensions(elementRef)
 *
 * console.log(width.value) // 元素宽度
 */
export function useElementDimensions(target: Ref<HTMLElement | null | undefined>) {
  const { width, height } = useElementSize(target)

  return {
    width,
    height
  }
}

/**
 * 元素可见性
 *
 * @param target - 目标元素 ref
 *
 * @example
 * const elementRef = ref<HTMLElement>()
 * const { isVisible } = useVisible(elementRef)
 *
 * watch(isVisible, (visible) => {
 *   if (visible) {
 *     console.log('元素进入视口')
 *   }
 * })
 */
export function useVisible(target: Ref<HTMLElement | null | undefined>) {
  const isVisible = useElementVisibility(target)

  return {
    isVisible,
    isHidden: computed(() => !isVisible.value)
  }
}

/**
 * 响应式断点
 *
 * @example
 * const { current, isMobile, isTablet, isDesktop } = useBreakpoint()
 *
 * console.log(current.value) // 'mobile' | 'tablet' | 'desktop'
 */
export function useBreakpoint() {
  const { width } = useWindowSize()

  const current = computed(() => {
    if (width.value < 768) return 'mobile'
    if (width.value < 1024) return 'tablet'
    return 'desktop'
  })

  return {
    current,
    isMobile: computed(() => current.value === 'mobile'),
    isTablet: computed(() => current.value === 'tablet'),
    isDesktop: computed(() => current.value === 'desktop')
  }
}
