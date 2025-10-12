/**
 * Service Container
 * 依赖注入容器，管理所有服务实例，解决循环依赖问题
 */

type ServiceFactory<T> = () => T
type ServiceInstance = any

/**
 * 服务容器类
 * 职责：
 * 1. 注册服务工厂函数
 * 2. 延迟初始化服务（第一次获取时才创建）
 * 3. 单例管理（同一个服务只创建一次）
 * 4. 解决循环依赖（通过延迟初始化）
 */
class ServiceContainer {
  // 存储服务工厂函数
  private factories = new Map<string, ServiceFactory<any>>()

  // 存储已创建的服务实例（单例）
  private instances = new Map<string, ServiceInstance>()

  // 正在创建的服务（用于检测循环依赖）
  private creating = new Set<string>()

  /**
   * 注册服务
   * @param name 服务名称
   * @param factory 服务工厂函数（返回服务实例）
   */
  register<T>(name: string, factory: ServiceFactory<T>): void {
    if (this.factories.has(name)) {
      console.warn(`Service "${name}" is already registered, overwriting...`)
    }
    this.factories.set(name, factory)
  }

  /**
   * 获取服务实例
   * @param name 服务名称
   * @returns 服务实例
   */
  get<T>(name: string): T {
    // 如果实例已存在，直接返回（单例）
    if (this.instances.has(name)) {
      return this.instances.get(name) as T
    }

    // 检测循环依赖
    if (this.creating.has(name)) {
      throw new Error(
        `Circular dependency detected when creating service "${name}". ` +
          `Currently creating: ${Array.from(this.creating).join(' -> ')}`
      )
    }

    // 获取工厂函数
    const factory = this.factories.get(name)
    if (!factory) {
      throw new Error(`Service "${name}" is not registered`)
    }

    // 标记正在创建
    this.creating.add(name)

    try {
      // 执行工厂函数创建实例
      const instance = factory()

      // 保存实例
      this.instances.set(name, instance)

      // 移除创建标记
      this.creating.delete(name)

      return instance as T
    } catch (error) {
      // 创建失败，移除标记
      this.creating.delete(name)
      throw error
    }
  }

  /**
   * 检查服务是否已注册
   */
  has(name: string): boolean {
    return this.factories.has(name)
  }

  /**
   * 检查服务实例是否已创建
   */
  isCreated(name: string): boolean {
    return this.instances.has(name)
  }

  /**
   * 清除所有服务实例（用于测试）
   */
  clear(): void {
    this.instances.clear()
    this.creating.clear()
  }

  /**
   * 重置容器（清除所有注册和实例）
   */
  reset(): void {
    this.factories.clear()
    this.instances.clear()
    this.creating.clear()
  }

  /**
   * 获取所有已注册的服务名称
   */
  getRegisteredServices(): string[] {
    return Array.from(this.factories.keys())
  }

  /**
   * 获取所有已创建的服务名称
   */
  getCreatedServices(): string[] {
    return Array.from(this.instances.keys())
  }
}

// 导出全局容器实例
export const container = new ServiceContainer()

/**
 * 便捷的服务注册装饰器（可选，用于类）
 */
export function Service(name: string) {
  return function (target: any) {
    container.register(name, () => new target())
    return target
  }
}
