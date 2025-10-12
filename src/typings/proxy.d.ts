/**
 * 代理相关类型定义
 */
declare namespace Proxy {
  /** 代理类型 */
  type ProxyType = 'http' | 'https' | 'socks5';

  /** 代理配置 */
  interface ProxyConfig {
    /** 代理类型 */
    type: ProxyType;
    /** 主机地址 */
    host: string;
    /** 端口 */
    port: number;
    /** 用户名（可选） */
    username?: string;
    /** 密码（可选） */
    password?: string;
  }

  /** 代理状态 */
  type ProxyStatus = 'normal' | 'slow' | 'failed' | 'unknown';

  /** 代理信息（带统计） */
  interface ProxyInfo extends ProxyConfig {
    /** 代理ID */
    id: string;
    /** 状态 */
    status: ProxyStatus;
    /** 使用次数 */
    usageCount?: number;
    /** 成功率（0-100） */
    successRate?: number;
    /** 平均响应时间（毫秒） */
    avgResponseTime?: number;
    /** 最后使用时间 */
    lastUsedAt?: string;
    /** 创建时间 */
    createdAt: string;
  }

  /** 代理测试结果 */
  interface ProxyTestResult {
    /** 是否成功 */
    success: boolean;
    /** 响应时间（毫秒） */
    responseTime?: number;
    /** 错误信息 */
    error?: string;
  }

  /** 代理分配策略 */
  type AssignStrategy = 'manual' | 'sequential' | 'random';

  /** 代理统计信息 */
  interface ProxyStatistics {
    /** 总代理数 */
    total: number;
    /** 正常代理数 */
    normal: number;
    /** 失败代理数 */
    failed: number;
    /** 平均成功率 */
    avgSuccessRate: number;
  }
}
