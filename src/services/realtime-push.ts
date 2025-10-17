/**
 * V3 Supabase Realtime 实时推送服务
 * 用于监听云端登录状态变化，实现毫秒级通知
 *
 * V3 改进：
 * - 使用 Supabase Realtime 替代原生 WebSocket
 * - 延迟降低到毫秒级（vs 2秒轮询）
 * - 自动重连和错误处理
 * - 免费计划支持 200 个并发连接
 */

import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

// 从环境变量读取 Supabase 配置
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jsfjdcbfftuaynwkmjey.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzZmpkY2JmZnR1YXlud2ttamV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwODI2NDUsImV4cCI6MjA3NTY1ODY0NX0.7SBL2PTnEuCE3sfEHby9jy6N75wjtVxGCtO7zUvN6cg';

import type { CloudPushData } from '@/types/push';

/**
 * Cookie 更新事件回调
 * 使用 CloudPushData 类型定义，确保类型安全
 */
export type CookieUpdateCallback = (data: CloudPushData) => void;

/**
 * Realtime 订阅连接
 */
interface RealtimeConnection {
  channel: RealtimeChannel;
  browserId: string;
  callbacks: CookieUpdateCallback[];
}

/**
 * Supabase Realtime 实时推送服务类
 */
export class RealtimePushService {
  private supabase: SupabaseClient | null = null;
  private connections: Map<string, RealtimeConnection> = new Map();
  private isInitialized = false;

  /**
   * 初始化服务
   */
  private initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      // 创建 Supabase 客户端
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        realtime: {
          params: {
            eventsPerSecond: 10 // 限制每秒事件数
          }
        }
      });

      console.log('[Realtime-V3] ✅ Supabase Realtime 服务初始化成功');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[Realtime-V3] ❌ 初始化失败:', error);
      return false;
    }
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.isInitialized || this.initialize();
  }

  /**
   * 注册账号状态变化的回调（统一的订阅方法）
   * @param browserId 浏览器ID
   * @param callback Cookie状态变化时的回调函数
   * @returns 订阅是否成功
   */
  subscribe(browserId: string, callback: CookieUpdateCallback): boolean {
    // 初始化服务
    if (!this.isInitialized && !this.initialize()) {
      console.warn('[Realtime-V3] 服务初始化失败');
      return false;
    }

    if (!this.supabase) {
      console.error('[Realtime-V3] Supabase 客户端未初始化');
      return false;
    }

    try {
      // 如果该 browserId 已有连接，只添加回调
      const existingConnection = this.connections.get(browserId);
      if (existingConnection) {
        existingConnection.callbacks.push(callback);
        console.log(`[Realtime-V3] ✅ 已添加回调: ${browserId} (总回调数: ${existingConnection.callbacks.length})`);
        return true;
      }

      // 创建新的 Realtime 订阅
      console.log(`[Realtime-V3] 正在订阅数据库更新: ${browserId}`);

      const channel = this.supabase
        .channel(`permanent_links_${browserId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'permanent_links',
            filter: `browser_id=eq.${browserId}`
          },
          (payload) => {
            const receiveTime = performance.now();
            console.log(`[Realtime-V3] 📨 收到数据库更新: ${browserId}`, {
              cookie_status: payload.new.cookie_status,
              nickname: payload.new.nickname,
              receiveTime: `${receiveTime.toFixed(2)}ms`
            });

            // 转换数据库字段为 CloudPushData 格式
            const data: Partial<CloudPushData> = {
              browserId,
              cookieStatus: payload.new.cookie_status,
              nickname: payload.new.nickname,
              avatar: payload.new.avatar,
              loginMethod: payload.new.login_method,  // ✅ 传递登录方式
              // ✅ 修复：根据 cookie_status 正确映射扫码状态
              // checking = 已扫码等待确认, online = 已确认登录, offline = 失效
              scanned: payload.new.cookie_status === 'checking' || payload.new.cookie_status === 'online',
              confirmed: payload.new.cookie_status === 'online',
              expired: payload.new.cookie_status === 'offline',
              // ✅ 传递视频号Cookie字段（用于自动获取流程）
              channelsSessionid: payload.new.channels_sessionid,
              channelsWxuin: payload.new.channels_wxuin
            };

            // 触发所有回调
            const connection = this.connections.get(browserId);
            if (connection) {
              const callbackStartTime = performance.now();
              connection.callbacks.forEach((cb, index) => {
                const cbStart = performance.now();
                cb(data as CloudPushData);
                const cbEnd = performance.now();
                console.log(`[Realtime-V3] ⏱️ Callback ${index + 1} 执行时间: ${(cbEnd - cbStart).toFixed(2)}ms`);
              });
              const callbackEndTime = performance.now();
              console.log(`[Realtime-V3] ⏱️ 所有 Callback 总执行时间: ${(callbackEndTime - callbackStartTime).toFixed(2)}ms`);
            }
          }
        )
        .subscribe((status) => {
          console.log(`[Realtime-V3] 订阅状态: ${browserId} - ${status}`);
        });

      const connection: RealtimeConnection = {
        channel,
        browserId,
        callbacks: [callback]
      };

      this.connections.set(browserId, connection);

      console.log(`[Realtime-V3] ✅ 已创建订阅: ${browserId} (总订阅数: ${this.connections.size})`);
      return true;

    } catch (error) {
      console.error('[Realtime-V3] 订阅账号状态失败', error);
      return false;
    }
  }

  /**
   * 取消订阅（移除所有回调，关闭连接）
   * @param browserId 浏览器ID
   */
  async unsubscribe(browserId: string): Promise<void> {
    const connection = this.connections.get(browserId);
    if (!connection || !this.supabase) {
      return;
    }

    try {
      // 取消 Realtime 订阅
      await this.supabase.removeChannel(connection.channel);

      // 从连接池中移除
      this.connections.delete(browserId);

      console.log(`[Realtime-V3] ✅ 已取消订阅: ${browserId} (剩余订阅数: ${this.connections.size})`);
    } catch (error) {
      console.error(`[Realtime-V3] 取消订阅失败: ${browserId}`, error);
    }
  }

  /**
   * 取消所有订阅
   */
  async unsubscribeAll(): Promise<void> {
    console.log(`[Realtime-V3] 正在关闭所有订阅 (${this.connections.size} 个)`);

    const browserIds = Array.from(this.connections.keys());

    for (const browserId of browserIds) {
      await this.unsubscribe(browserId);
    }

    this.connections.clear();
    console.log('[Realtime-V3] ✅ 所有订阅已关闭');
  }

  /**
   * 获取当前订阅数量（账号数量）
   */
  getSubscriptionCount(): number {
    return this.connections.size;
  }

  /**
   * 获取总回调数量
   */
  getTotalCallbackCount(): number {
    return Array.from(this.connections.values())
      .reduce((sum, conn) => sum + conn.callbacks.length, 0);
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(browserId: string): 'connecting' | 'open' | 'closing' | 'closed' | 'not_found' {
    const connection = this.connections.get(browserId);
    if (!connection) {
      return 'not_found';
    }

    // Supabase Realtime Channel 没有直接的 readyState
    // 简单返回 'open'（订阅后即为连接状态）
    return 'open';
  }

  /**
   * 销毁服务（释放资源）
   */
  async destroy(): Promise<void> {
    await this.unsubscribeAll();
    this.isInitialized = false;
    this.supabase = null;
    console.log('[Realtime-V3] 服务已销毁');
  }
}

// 导出单例实例
export const realtimePushService = new RealtimePushService();
