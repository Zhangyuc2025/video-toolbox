/**
 * Supabase Realtime 实时推送服务
 * 用于监听云端登录状态变化，实现毫秒级通知
 */
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

// Supabase 配置
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 检查配置是否有效
const isSupabaseConfigured = SUPABASE_URL && SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_ANON_KEY.includes('your-anon-key');

// 调试日志
console.log('[Realtime] 配置检查:', {
  SUPABASE_URL: SUPABASE_URL ? `${SUPABASE_URL.substring(0, 30)}...` : '❌ 未设置',
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 30)}...` : '❌ 未设置',
  isSupabaseConfigured: isSupabaseConfigured ? '✅ 已配置' : '❌ 未配置'
});

/**
 * Cookie 更新事件回调
 */
export type CookieUpdateCallback = (data: {
  browserId: string;
  cookies: any;
  nickname?: string;
  avatar?: string;
  loginMethod?: string;
  wechatStatus?: number; // 微信原始状态：视频号助手 0/5/1, 小店助手 1/2/3
  loginStatus?: string; // 登录状态：waiting, scanned, confirmed, completed, expired
  cookieStatus?: string; // Cookie状态：pending(未登录), online(在线), offline(掉线)
  cookieExpiredAt?: string; // Cookie失效时间
  oldData?: {
    wechatStatus?: number;
    cookieStatus?: string;
    loginStatus?: string;
    nickname?: string;
  }; // 旧数据，用于比较变化
}) => void;

/**
 * Realtime 推送服务类
 */
export class RealtimePushService {
  private supabase: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private callbacks: Map<string, CookieUpdateCallback[]> = new Map(); // browserId → callbacks[]
  private isInitialized = false;

  /**
   * 初始化 Supabase 客户端
   */
  private initialize() {
    if (this.isInitialized || !isSupabaseConfigured) {
      return false;
    }

    try {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: {
          params: {
            eventsPerSecond: 10 // 限制事件频率
          }
        }
      });

      this.isInitialized = true;
      console.log('[Realtime] ✅ Supabase 客户端初始化成功');
      return true;
    } catch (error) {
      console.error('[Realtime] Supabase 客户端初始化失败:', error);
      return false;
    }
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return isSupabaseConfigured && this.isInitialized;
  }

  /**
   * 注册账号状态变化的回调（统一的订阅方法）
   * @param browserId 浏览器ID
   * @param callback Cookie状态变化时的回调函数
   * @returns 订阅是否成功
   */
  subscribe(browserId: string, callback: CookieUpdateCallback): boolean {
    // 如果 Supabase 未配置，返回 false
    if (!isSupabaseConfigured) {
      console.warn('[Realtime] Supabase 未配置，无法订阅账号状态');
      return false;
    }

    // 初始化客户端
    if (!this.isInitialized && !this.initialize()) {
      console.warn('[Realtime] 客户端初始化失败');
      return false;
    }

    if (!this.supabase) {
      return false;
    }

    try {
      // 首次订阅时，创建全局 Broadcast 频道
      if (!this.channel) {
        console.log('[Realtime] 正在创建 Channel: accounts_realtime');

        this.channel = this.supabase
          .channel('accounts_realtime')
          .on(
            'broadcast',
            { event: 'account_update' },
            (payload) => {
              const data = payload.payload;

              console.log('[Realtime] 📨 收到广播消息:', {
                browserId: data.browserId,
                cookieStatus: data.cookieStatus,
                loginStatus: data.loginStatus,
                wechatStatus: data.wechatStatus
              });

              // 查找该 browserId 的所有回调并触发
              const callbacks = this.callbacks.get(data.browserId);
              if (callbacks && callbacks.length > 0) {
                console.log(`[Realtime] 触发 ${callbacks.length} 个回调: ${data.browserId}`);
                callbacks.forEach(cb => {
                  cb({
                    browserId: data.browserId,
                    cookies: data.cookies,
                    nickname: data.nickname,
                    avatar: data.avatar,
                    loginMethod: data.loginMethod,
                    wechatStatus: data.wechatStatus,
                    loginStatus: data.loginStatus,
                    cookieStatus: data.cookieStatus,
                    cookieExpiredAt: data.cookieExpiredAt,
                    oldData: data.oldData
                  });
                });
              } else {
                console.warn(`[Realtime] ⚠️ 未找到回调: ${data.browserId}`);
              }
            }
          )
          .subscribe((status) => {
            console.log(`[Realtime] Channel 状态变化: ${status}`);

            if (status === 'SUBSCRIBED') {
              console.log('[Realtime] ✅ Channel 订阅成功，等待接收消息');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('[Realtime] ❌ Channel 连接错误，WebSocket 可能失败');
              // 不立即设为 null，让它保持连接状态
              // this.channel = null;
            } else if (status === 'TIMED_OUT') {
              console.error('[Realtime] ❌ Channel 连接超时');
              this.channel = null;
            } else if (status === 'CLOSED') {
              console.warn('[Realtime] Channel 已关闭');
              this.channel = null;
            }
          });
      }

      // 注册回调到对应 browserId
      if (!this.callbacks.has(browserId)) {
        this.callbacks.set(browserId, []);
      }

      this.callbacks.get(browserId)!.push(callback);

      console.log(`[Realtime] ✅ 已注册回调: ${browserId} (总订阅数: ${this.callbacks.size})`);

      return true;
    } catch (error) {
      console.error('[Realtime] 订阅账号状态失败', error);
      return false;
    }
  }


  /**
   * 取消订阅（移除所有回调）
   * @param browserId 浏览器ID
   */
  async unsubscribe(browserId: string): Promise<void> {
    if (!this.callbacks.has(browserId)) {
      return;
    }

    try {
      this.callbacks.delete(browserId);

      // 如果没有任何回调了，关闭全局频道
      if (this.callbacks.size === 0 && this.channel) {
        await this.supabase?.removeChannel(this.channel);
        this.channel = null;
      }
    } catch (error) {
      console.error(`[Realtime] 取消订阅失败: ${browserId}`, error);
    }
  }

  /**
   * 取消所有订阅
   */
  async unsubscribeAll(): Promise<void> {
    // 清空所有回调
    this.callbacks.clear();

    // 关闭全局频道
    if (this.channel) {
      try {
        await this.supabase?.removeChannel(this.channel);
        this.channel = null;
      } catch (error) {
        console.error('[Realtime] 关闭频道失败:', error);
      }
    }
  }

  /**
   * 获取当前订阅数量（账号数量）
   */
  getSubscriptionCount(): number {
    return this.callbacks.size;
  }

  /**
   * 获取总回调数量
   */
  getTotalCallbackCount(): number {
    return Array.from(this.callbacks.values())
      .reduce((sum, cbs) => sum + cbs.length, 0);
  }

  /**
   * 销毁服务（释放资源）
   */
  async destroy(): Promise<void> {
    await this.unsubscribeAll();

    if (this.supabase) {
      this.supabase.removeAllChannels();
      this.supabase = null;
    }

    this.isInitialized = false;
  }
}

// 导出单例实例
export const realtimePushService = new RealtimePushService();
