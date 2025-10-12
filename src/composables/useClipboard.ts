/**
 * 剪贴板工具
 * 基于 VueUse 的 useClipboard
 */
import { useClipboard as vueUseClipboard } from '@vueuse/core'

/**
 * 剪贴板操作
 *
 * @example
 * const { copy, copied, text } = useClipboard()
 *
 * async function handleCopy() {
 *   await copy('Hello World')
 *   if (copied.value) {
 *     window.$message?.success('已复制')
 *   }
 * }
 */
export function useClipboard() {
  const { copy: vueCopy, copied, text, isSupported } = vueUseClipboard()

  /**
   * 复制文本到剪贴板
   */
  async function copy(content: string): Promise<boolean> {
    try {
      await vueCopy(content)
      return copied.value
    } catch (error) {
      console.error('复制失败:', error)
      return false
    }
  }

  /**
   * 复制文本并显示提示
   */
  async function copyWithMessage(content: string, message: string = '已复制'): Promise<boolean> {
    const success = await copy(content)

    if (typeof window !== 'undefined' && window.$message) {
      if (success) {
        window.$message.success(message)
      } else {
        window.$message.error('复制失败')
      }
    }

    return success
  }

  return {
    copy,
    copyWithMessage,
    copied,
    text,
    isSupported
  }
}

/**
 * 复制到剪贴板（简化版）
 *
 * @param content - 要复制的内容
 * @param showMessage - 是否显示提示消息
 *
 * @example
 * await copyToClipboard('Hello World')
 */
export async function copyToClipboard(content: string, showMessage: boolean = true): Promise<boolean> {
  const { copyWithMessage, copy } = useClipboard()

  if (showMessage) {
    return copyWithMessage(content)
  } else {
    return copy(content)
  }
}
