/**
 * Proxy Service
 * 管理代理配置
 */
import { BaseService } from './base'
import { configStore } from '@/utils/config-store'

/**
 * Proxy Service 类
 */
export class ProxyService extends BaseService {
  /**
   * 获取所有代理
   */
  async getProxies(): Promise<Proxy.ProxyInfo[]> {
    try {
      const proxies = await configStore.getProxies()
      return proxies
    } catch (error) {
      this.log('error', '获取代理列表失败', error)
      return []
    }
  }

  /**
   * 添加代理
   */
  async addProxy(proxy: Omit<Proxy.ProxyInfo, 'id' | 'createdAt'>): Promise<boolean> {
    try {
      // 验证必需字段
      if (!this.validateRequired(proxy, ['type', 'host', 'port'])) {
        return false
      }

      // 验证代理配置
      if (!this.validateProxyConfig(proxy)) {
        return false
      }

      // 生成完整的代理信息
      const proxyInfo: Proxy.ProxyInfo = {
        id: crypto.randomUUID(),
        ...proxy,
        status: 'normal',
        createdAt: new Date().toISOString()
      }

      await configStore.addProxy(proxyInfo)
      this.log('success', '添加代理成功', proxyInfo)
      this.showMessage('success', '代理添加成功')

      return true
    } catch (error) {
      this.log('error', '添加代理失败', error)
      this.showMessage('error', '添加代理失败')
      return false
    }
  }

  /**
   * 更新代理
   */
  async updateProxy(index: number, proxy: Proxy.ProxyInfo): Promise<boolean> {
    try {
      if (!this.validateProxyConfig(proxy)) {
        return false
      }

      await configStore.updateProxy(index, proxy)
      this.log('success', '更新代理成功', proxy)
      this.showMessage('success', '代理更新成功')

      return true
    } catch (error) {
      this.log('error', '更新代理失败', error)
      this.showMessage('error', '更新代理失败')
      return false
    }
  }

  /**
   * 删除代理
   */
  async deleteProxy(index: number): Promise<boolean> {
    try {
      await configStore.deleteProxy(index)
      this.log('success', `删除代理成功: index ${index}`)
      this.showMessage('success', '代理删除成功')

      return true
    } catch (error) {
      this.log('error', '删除代理失败', error)
      this.showMessage('error', '删除代理失败')
      return false
    }
  }

  /**
   * 批量删除代理
   */
  async batchDeleteProxies(indices: number[]): Promise<boolean> {
    try {
      // 从大到小排序，避免删除后索引错位
      const sortedIndices = indices.sort((a, b) => b - a)

      for (const index of sortedIndices) {
        await configStore.deleteProxy(index)
      }

      this.log('success', `批量删除代理成功: ${indices.length} 个`)
      this.showMessage('success', `成功删除 ${indices.length} 个代理`)

      return true
    } catch (error) {
      this.log('error', '批量删除代理失败', error)
      this.showMessage('error', '批量删除失败')
      return false
    }
  }

  /**
   * 根据 ID 查找代理
   */
  async findProxyById(id: string): Promise<{ proxy: Proxy.ProxyInfo; index: number } | null> {
    try {
      const proxies = await this.getProxies()
      const index = proxies.findIndex(p => p.id === id)

      if (index === -1) {
        return null
      }

      return {
        proxy: proxies[index],
        index
      }
    } catch (error) {
      this.log('error', '查找代理失败', error)
      return null
    }
  }

  /**
   * 更新代理状态
   */
  async updateProxyStatus(index: number, status: Proxy.ProxyStatus): Promise<boolean> {
    try {
      const proxies = await this.getProxies()

      if (index < 0 || index >= proxies.length) {
        this.showMessage('error', '代理索引无效')
        return false
      }

      const proxy = proxies[index]
      proxy.status = status

      return this.updateProxy(index, proxy)
    } catch (error) {
      this.log('error', '更新代理状态失败', error)
      return false
    }
  }

  /**
   * 更新代理统计
   */
  async updateProxyStats(
    index: number,
    stats: Partial<Proxy.ProxyStats>
  ): Promise<boolean> {
    try {
      const proxies = await this.getProxies()

      if (index < 0 || index >= proxies.length) {
        return false
      }

      const proxy = proxies[index]

      if (!proxy.stats) {
        proxy.stats = {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          lastUsedAt: undefined,
          avgResponseTime: undefined
        }
      }

      proxy.stats = {
        ...proxy.stats,
        ...stats
      }

      return this.updateProxy(index, proxy)
    } catch (error) {
      this.log('error', '更新代理统计失败', error)
      return false
    }
  }

  /**
   * 增加代理使用次数
   */
  async incrementProxyUsage(index: number, success: boolean): Promise<boolean> {
    try {
      const proxies = await this.getProxies()

      if (index < 0 || index >= proxies.length) {
        return false
      }

      const proxy = proxies[index]

      if (!proxy.stats) {
        proxy.stats = {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0
        }
      }

      proxy.stats.totalRequests++

      if (success) {
        proxy.stats.successRequests++
      } else {
        proxy.stats.failedRequests++
      }

      proxy.stats.lastUsedAt = new Date().toISOString()

      return this.updateProxy(index, proxy)
    } catch (error) {
      this.log('error', '更新代理使用统计失败', error)
      return false
    }
  }

  /**
   * 获取可用的代理（状态正常）
   */
  async getAvailableProxies(): Promise<Proxy.ProxyInfo[]> {
    const proxies = await this.getProxies()
    return proxies.filter(p => p.status === 'normal')
  }

  /**
   * 获取失败的代理
   */
  async getFailedProxies(): Promise<Proxy.ProxyInfo[]> {
    const proxies = await this.getProxies()
    return proxies.filter(p => p.status === 'failed')
  }

  /**
   * 随机获取一个可用代理
   */
  async getRandomProxy(): Promise<Proxy.ProxyInfo | null> {
    const availableProxies = await this.getAvailableProxies()

    if (availableProxies.length === 0) {
      return null
    }

    const randomIndex = Math.floor(Math.random() * availableProxies.length)
    return availableProxies[randomIndex]
  }

  /**
   * 验证代理配置
   */
  private validateProxyConfig(proxy: any): boolean {
    // 验证代理类型
    const validTypes: Proxy.ProxyType[] = ['http', 'https', 'socks5']
    if (!validTypes.includes(proxy.type)) {
      this.showMessage('error', '代理类型无效')
      return false
    }

    // 验证主机名
    if (!proxy.host || proxy.host.trim() === '') {
      this.showMessage('error', '请输入代理主机')
      return false
    }

    // 验证端口
    const port = parseInt(proxy.port)
    if (isNaN(port) || port < 1 || port > 65535) {
      this.showMessage('error', '端口号无效（1-65535）')
      return false
    }

    return true
  }

  /**
   * 格式化代理为字符串
   */
  formatProxyString(proxy: Proxy.ProxyInfo): string {
    const { type, host, port, username, password } = proxy

    if (username && password) {
      return `${type}://${username}:${password}@${host}:${port}`
    }

    return `${type}://${host}:${port}`
  }

  /**
   * 从字符串解析代理
   */
  parseProxyString(proxyString: string): Omit<Proxy.ProxyInfo, 'id' | 'createdAt' | 'status'> | null {
    try {
      // 格式: protocol://[username:password@]host:port
      const regex = /^(https?|socks5):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/
      const match = proxyString.match(regex)

      if (!match) {
        return null
      }

      const [, type, username, password, host, port] = match

      return {
        type: type as Proxy.ProxyType,
        host,
        port,
        username: username || undefined,
        password: password || undefined
      }
    } catch (error) {
      this.log('error', '解析代理字符串失败', error)
      return null
    }
  }

  /**
   * 批量导入代理（从字符串数组）
   */
  async batchImportProxies(proxyStrings: string[]): Promise<number> {
    let successCount = 0

    for (const proxyString of proxyStrings) {
      const parsed = this.parseProxyString(proxyString.trim())

      if (parsed) {
        const success = await this.addProxy(parsed)
        if (success) {
          successCount++
        }
      }
    }

    this.showMessage('info', `成功导入 ${successCount}/${proxyStrings.length} 个代理`)
    return successCount
  }

  /**
   * 导出代理为字符串数组
   */
  async exportProxies(): Promise<string[]> {
    const proxies = await this.getProxies()
    return proxies.map(p => this.formatProxyString(p))
  }

  /**
   * 测试代理连接（需要后续实现具体的测试逻辑）
   */
  async testProxy(index: number): Promise<boolean> {
    // TODO: 实现代理测试逻辑
    // 可以通过调用一个测试 API 来验证代理是否可用
    this.log('warn', '代理测试功能待实现')
    return false
  }
}

// 注意：不再直接导出单例，服务实例由容器管理
// 请从 @/services 导入 proxyService
