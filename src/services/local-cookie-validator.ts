/**
 * 本地Cookie验证服务
 * 通过Tauri后端调用微信API验证Cookie有效性，绕过浏览器CORS限制
 *
 * 架构说明：
 * - 前端调用 validateCookie(browserId)
 * - Tauri后端（Rust）从BitBrowser获取Cookie并调用微信API验证
 * - 包含：重试机制、限流检测、完整错误处理
 */
import { invoke } from '@tauri-apps/api/tauri';
import { BaseService } from './base';

/**
 * Cookie验证结果
 */
export interface CookieValidationResult {
  valid: boolean;              // Cookie是否有效
  cookieStatus: 'online' | 'offline' | 'checking';  // Cookie状态
  nickname?: string;           // 账号昵称
  avatar?: string;             // 账号头像
  wechatId?: string;           // 视频号助手专用：微信ID
  finderUsername?: string;     // 视频号用户名
  appuin?: string;             // 带货助手专用：唯一标识
  shopName?: string;           // 店铺名称
  error?: string;              // 错误信息
  loginMethod?: 'channels_helper' | 'shop_helper';  // 登录方式
  needRefetchChannelsCookie?: boolean;  // 是否需要重新获取视频号Cookie（仅带货助手）
  isRateLimited?: boolean;     // 是否触发API限流
}

/**
 * 本地Cookie验证服务类
 */
export class LocalCookieValidator extends BaseService {
  /**
   * 验证浏览器Cookie（通过Tauri后端实现）
   *
   * ✅ 修复：接受 loginMethod 参数，不再通过Cookie名称检测
   * loginMethod 来自云端数据库，是权威来源
   *
   * @param browserId 浏览器ID
   * @param loginMethod 登录方式（来自云端数据库）
   * @returns 验证结果
   */
  async validateCookie(browserId: string, loginMethod: 'channels_helper' | 'shop_helper'): Promise<CookieValidationResult | null> {
    try {
      console.log(`[本地验证] 开始验证浏览器Cookie: ${browserId}, 登录方式: ${loginMethod}`);

      // 调用Tauri后端命令进行验证（Rust会调用微信API，绕过CORS限制）
      const result = await invoke<CookieValidationResult>('validate_cookie', {
        browserId,
        loginMethod
      });

      console.log(`[本地验证] 验证完成: valid=${result.valid}, status=${result.cookieStatus}`);

      return result;
    } catch (error) {
      console.error('[本地验证] 验证失败:', error);
      return {
        valid: false,
        cookieStatus: 'offline',
        error: String(error)
      };
    }
  }

}

// 导出单例
export const localCookieValidator = new LocalCookieValidator();
