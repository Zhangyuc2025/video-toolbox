/**
 * 视频号Cookie自动获取服务
 * 专门用于带货助手账号自动获取视频号Cookie
 */

import { invoke } from '@tauri-apps/api/tauri';
import { configStore } from '@/utils/config-store';
import { AccountMonitorService } from '@/services/account-monitor';
import { notification } from '@/utils';
import type { CloudPushData } from '@/types/push';

interface FetchChannelsCookieOptions {
  browserId: string;
  nickname?: string;
  timeout?: number;
  skipOpen?: boolean; // 跳过打开浏览器步骤（浏览器已经打开时使用）
}

/**
 * 自动获取视频号Cookie（带货助手登录专用）
 *
 * 流程：
 * 1. 打开浏览器（触发插件自动跳转到视频号）
 * 2. 监听 channels_sessionid 字段变化（Cookie上传完成）
 * 3. Cookie上传成功后自动关闭浏览器
 */
export async function autoFetchChannelsCookie(options: FetchChannelsCookieOptions): Promise<boolean> {
  const { browserId, nickname, timeout = 90000, skipOpen = false } = options;

  console.log(`[自动获取CK] 开始流程: ${browserId}${skipOpen ? ' (跳过打开浏览器)' : ''}`);

  try {
    // 1. 打开浏览器（如果需要）
    if (!skipOpen) {
      console.log(`[自动获取CK] 打开浏览器: ${browserId}`);

      // ✅ 安全获取 owner，如果失败使用空字符串
      let owner = '';
      try {
        owner = await configStore.getUsername() || '';
      } catch (error) {
        console.warn(`[自动获取CK] 获取 owner 失败，使用空字符串:`, error);
      }

      const openResult = await invoke<{ success: boolean; message?: string }>('open_browser', {
        browserId,
        args: [],
        loadUrl: `https://store.weixin.qq.com/talent/funds/order#plugin_mode=shop&browser_id=${encodeURIComponent(browserId)}&owner=${encodeURIComponent(owner || '')}`,
        clearCookies: false
      });

      if (!openResult.success) {
        console.error(`[自动获取CK] 打开浏览器失败: ${openResult.message}`);
        notification.error(`自动获取视频号Cookie失败: ${openResult.message}`);
        return false;
      }
    } else {
      console.log(`[自动获取CK] 浏览器已打开，直接监听Cookie上传: ${browserId}`);
    }

    notification.info(`正在自动获取 ${nickname || browserId} 的视频号Cookie，请稍候...`);

    // 2. 订阅 Realtime 推送，监听 channels_sessionid 字段变化（插件上传完成）
    let isCompleted = false;
    let success = false;

    const handleCookieUpdate = async (data: CloudPushData) => {
      // ✅ 使用 isCompleted 标志防止重复执行(订阅会保持,但回调变成空操作)
      if (data.browserId !== browserId || isCompleted) {
        return;
      }

      // ✅ 监听 channelsSessionid 字段（插件提取并上传的视频号Cookie）
      if (data.channelsSessionid) {
        console.log(`[自动获取CK] 检测到视频号Cookie已上传: ${browserId}`, {
          sessionid: data.channelsSessionid.substring(0, 20) + '...',
          wxuin: data.channelsWxuin
        });
        isCompleted = true;
        success = true;

        // 等待2秒确保插件完成所有操作
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. 关闭浏览器（只有自动打开的浏览器才自动关闭）
        if (!skipOpen) {
          try {
            await invoke('close_browser', { browserId });
            console.log(`[自动获取CK] 浏览器已自动关闭: ${browserId}`);
            notification.success(`成功获取 ${nickname || browserId} 的视频号Cookie，浏览器已自动关闭`);
          } catch (error) {
            console.error(`[自动获取CK] 关闭浏览器失败:`, error);
          }
        } else {
          console.log(`[自动获取CK] Cookie获取完成，浏览器由用户手动打开，不自动关闭`);
          notification.success(`成功获取 ${nickname || browserId} 的视频号Cookie`);
        }
      }
    };

    // 包装 handleCookieUpdate 以清理超时定时器
    let timeoutTimer: NodeJS.Timeout | null = null;

    const wrappedHandler = async (data: CloudPushData) => {
      await handleCookieUpdate(data);
      if (isCompleted && timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };

    // 确保订阅（添加回调监听）
    // 注意: 这个回调会一直存在,但 isCompleted 标志会让它变成空操作
    AccountMonitorService.ensureSubscribed(browserId, wrappedHandler);

    // 设置超时检查
    const timeoutPromise = new Promise<boolean>((resolve) => {
      timeoutTimer = setTimeout(async () => {
        if (!isCompleted) {
          console.warn(`[自动获取CK] 超时未完成: ${browserId}`);
          notification.warning(`自动获取 ${nickname || browserId} 的视频号Cookie超时，请手动检查`);

          // ✅ 标记为已完成,后续的推送会被忽略
          isCompleted = true;

          // 尝试关闭浏览器（只关闭自动打开的浏览器）
          if (!skipOpen) {
            try {
              await invoke('close_browser', { browserId });
              console.log(`[自动获取CK] 超时，已关闭自动打开的浏览器: ${browserId}`);
            } catch (error) {
              console.error(`[自动获取CK] 关闭浏览器失败:`, error);
            }
          } else {
            console.log(`[自动获取CK] 超时，但浏览器是手动打开的，不自动关闭`);
          }

          resolve(false);
        }
      }, timeout);
    });

    // 等待完成或超时
    if (isCompleted) {
      return success;
    }

    return await timeoutPromise;

  } catch (error) {
    console.error(`[自动获取CK] 流程异常:`, error);
    notification.error(`自动获取视频号Cookie失败: ${error}`);
    return false;
  }
}

/**
 * 检测账号是否缺少视频号Cookie
 *
 * @param browserId - 浏览器ID
 * @returns 是否缺少视频号Cookie
 */
export async function checkMissingChannelsCookie(browserId: string): Promise<boolean> {
  try {
    // 从云端获取账号信息
    const cloudStatus = AccountMonitorService.getAccountStatus(browserId);

    if (!cloudStatus) {
      console.log(`[检测CK] 未找到账号状态: ${browserId}`);
      return false;
    }

    // 只检测带货助手账号
    const loginMethod = cloudStatus.accountInfo?.loginMethod;
    console.log(`[检测CK] 账号登录方式: ${loginMethod} (browserId: ${browserId})`);

    if (loginMethod !== 'shop_helper') {
      console.log(`[检测CK] 不是带货助手账号，跳过检测`);
      return false;
    }

    // ✅ 从 BitBrowser 读取实际 Cookie（实时数据）
    try {
      const cookies = await invoke<{ success: boolean; data?: { cookies: any[] } }>('get_browser_cookies', { browserId });

      if (!cookies.success || !cookies.data?.cookies || cookies.data.cookies.length === 0) {
        console.log(`[检测CK] BitBrowser中无Cookie: ${browserId}`);
        return true; // 没有Cookie，需要获取
      }

      // 检查是否有视频号Cookie (sessionid 或 _finder_auth)
      const hasChannelsCookie = cookies.data.cookies.some((c: any) =>
        c.name === 'sessionid' || c.name === '_finder_auth'
      );

      if (!hasChannelsCookie) {
        console.log(`[检测CK] 带货助手账号缺少视频号Cookie: ${browserId}`);
        return true;
      }

      console.log(`[检测CK] 已有视频号Cookie，无需自动获取: ${browserId}`);
      return false;
    } catch (error) {
      console.error(`[检测CK] 读取BitBrowser Cookie失败:`, error);
      // 读取失败，认为需要获取
      return true;
    }
  } catch (error) {
    console.error(`[检测CK] 检测失败:`, error);
    return false;
  }
}
