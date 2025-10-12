/**
 * Service 基类
 * 提供通用的错误处理、日志记录等功能
 */
import { invoke } from '@tauri-apps/api'
import { apiLimiter } from '@/utils/api-limiter'

/**
 * API 响应接口
 */
export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
}

/**
 * Service 配置
 */
export interface ServiceConfig {
  /** 是否显示成功消息 */
  showSuccessMessage?: boolean
  /** 是否显示错误消息 */
  showErrorMessage?: boolean
  /** 是否记录日志 */
  enableLogging?: boolean
}

/**
 * Service 基类
 */
export class BaseService {
  protected config: ServiceConfig

  constructor(config: ServiceConfig = {}) {
    this.config = {
      showSuccessMessage: false,
      showErrorMessage: true,
      enableLogging: true,
      ...config
    }
  }

  /**
   * 调用 Tauri Command
   */
  protected async invoke<T = any>(
    command: string,
    args?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      this.log('info', `调用命令: ${command}`, args)

      // 判断是否是 BitBrowser API 调用（以 bb_ 开头或 check_bitbrowser_status）
      const isBitBrowserApi = command.startsWith('bb_') || command === 'check_bitbrowser_status'

      let result: ApiResponse<T>

      if (isBitBrowserApi) {
        // BitBrowser API 调用，应用限流器
        result = await apiLimiter.runInternal(() => invoke<ApiResponse<T>>(command, args))
      } else {
        // 非 BitBrowser API 调用，直接执行
        result = await invoke<ApiResponse<T>>(command, args)
      }

      this.log('success', `命令成功: ${command}`, result)

      // 显示成功消息
      if (this.config.showSuccessMessage && result.success) {
        this.showMessage('success', result.message)
      }

      // 显示错误消息
      if (this.config.showErrorMessage && !result.success) {
        this.showMessage('error', result.message)
      }

      return result
    } catch (error) {
      this.log('error', `命令失败: ${command}`, error)

      const errorMessage = this.getErrorMessage(error)

      if (this.config.showErrorMessage) {
        this.showMessage('error', errorMessage)
      }

      return {
        success: false,
        message: errorMessage,
        data: undefined
      }
    }
  }

  /**
   * 批量调用（并发）
   */
  protected async invokeBatch<T = any>(
    command: string,
    argsList: Record<string, any>[]
  ): Promise<ApiResponse<T>[]> {
    const promises = argsList.map(args => this.invoke<T>(command, args))
    return Promise.all(promises)
  }

  /**
   * 显示消息（使用 NaiveUI message）
   */
  protected showMessage(type: 'success' | 'error' | 'warning' | 'info', content: string): void {
    if (typeof window !== 'undefined' && window.$message) {
      window.$message[type](content)
    }
  }

  /**
   * 记录日志
   */
  protected log(level: 'info' | 'success' | 'error' | 'warn', message: string, data?: any): void {
    if (!this.config.enableLogging) return

    const timestamp = new Date().toLocaleTimeString()
    const prefix = `[${timestamp}] [${this.constructor.name}]`

    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`, data || '')
        break
      case 'success':
        console.log(`${prefix} ✅ ${message}`, data || '')
        break
      case 'error':
        console.error(`${prefix} ❌ ${message}`, data || '')
        break
      case 'warn':
        console.warn(`${prefix} ⚠️ ${message}`, data || '')
        break
    }
  }

  /**
   * 获取错误消息
   */
  protected getErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error
    }

    if (error?.message) {
      return error.message
    }

    if (error?.toString) {
      return error.toString()
    }

    return '未知错误'
  }

  /**
   * 验证必需参数
   */
  protected validateRequired(params: Record<string, any>, required: string[]): boolean {
    for (const key of required) {
      if (params[key] === undefined || params[key] === null || params[key] === '') {
        this.showMessage('error', `缺少必需参数: ${key}`)
        return false
      }
    }
    return true
  }

  /**
   * 延迟执行
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 重试机制
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number
      retryDelay?: number
      retryCondition?: (error: any) => boolean
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, retryDelay = 1000, retryCondition = () => true } = options

    let lastError: any

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        this.log('warn', `重试 ${i + 1}/${maxRetries}`, error)

        if (!retryCondition(error) || i === maxRetries - 1) {
          throw error
        }

        await this.delay(retryDelay)
      }
    }

    throw lastError
  }
}

/**
 * 全局消息类型声明
 */
declare global {
  interface Window {
    $message?: {
      success: (content: string) => void
      error: (content: string) => void
      warning: (content: string) => void
      info: (content: string) => void
    }
  }
}
