/**
 * 新增账号逻辑
 */
import { ref, computed, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/tauri';
import { notification } from '@/utils';
import { configStore } from '@/utils/config-store';
import { CloudService } from '@/services/cloud';
import { AccountMonitorService } from '@/services/account-monitor';
import { apiLimiter } from '@/utils/api-limiter';
import type {
  AccountConfig,
  AccountCreateItem,
  AccountCreateState,
  LoginMethod,
  LoginWay,
  QRLoginResult,
  CreateBrowserResult
} from '@/types/account';
import type { CloudPushData } from '@/types/push';

export function useAddAccount() {
  // 当前步骤 (0: 配置, 1: 登录, 2: 完成)
  const currentStep = ref(0);

  // 是否正在处理
  const isProcessing = ref(false);

  // ✅ 全局上号方式（所有账号统一使用）
  const globalLoginWay = ref<LoginWay>('permanent_link');

  // ✅ 监听全局上号方式变化，同步到所有账号
  watch(globalLoginWay, (newWay) => {
    accounts.value.forEach(account => {
      account.config.loginWay = newWay;
    });
  });

  // ✅ 已处理的 browserId 集合（防止重复推送）
  const processedBrowserIds = new Set<string>();

  /**
   * ✅ 处理 Realtime 推送事件（包含中间状态和最终状态）
   * 使用 CloudPushData 类型确保类型安全
   */
  function handleRealtimePush(data: CloudPushData) {
    console.log(`[useAddAccount-Realtime] 收到推送: ${data.browserId}`, {
      scanned: data.scanned,
      confirmed: data.confirmed,
      expired: data.expired,
      cookieStatus: data.cookieStatus,
      nickname: data.nickname
    });

    // 查找对应的账号
    const account = accounts.value.find(acc => acc.browserId === data.browserId);

    if (!account) {
      console.log(`[useAddAccount-Realtime] 账号不在添加列表中，忽略: ${data.browserId}`);
      return;
    }

    // 跳过已完成或失败的账号
    if (account.state === 'success' || account.state === 'failed') {
      console.log(`[useAddAccount-Realtime] 账号已是终态 (${account.state})，忽略`);
      return;
    }

    // ✅ V2 简化版：使用布尔值判断状态
    if (data.scanned && !data.confirmed) {
      // 已扫码，等待确认
      account.state = 'scanned';
      account.progress = 50;
      nextTick();  // 强制立即更新 UI
      console.log(`[useAddAccount-Realtime] 二维码已扫描: ${data.browserId}`);
    }

    if (data.confirmed) {
      // 已确认登录
      account.state = 'confirmed';
      account.progress = 60;
      nextTick();  // 强制立即更新 UI
      console.log(`[useAddAccount-Realtime] 登录已确认: ${data.browserId}`);
    }

    if (data.expired) {
      // 二维码过期
      account.state = 'failed';
      account.errorMsg = '二维码已过期';
      nextTick();  // 强制立即更新 UI
      console.log(`[useAddAccount-Realtime] 二维码过期: ${data.browserId}`);
      return;
    }

    // ✅ 处理最终状态：cookieStatus 变为 online
    if (data.cookieStatus === 'online') {
      console.log(`[useAddAccount-Realtime] ✅ 检测到登录完成: ${data.browserId}`);

      // ✅ 优先使用 accountInfo，fallback 到单独字段
      const nickname = data.accountInfo?.nickname || data.nickname;
      const avatar = data.accountInfo?.avatar || data.avatar;
      const loginMethod = data.accountInfo?.loginMethod || data.loginMethod;

      // 触发登录完成处理
      handleLoginCompleted(account, {
        browserId: data.browserId,
        cookies: data.cookies || [],
        nickname,
        avatar,
        loginMethod,
        cookieStatus: 'online'
      });
    }
  }

  /**
   * 创建空账号
   */
  function createEmptyAccount(index = 0): AccountCreateItem {
    return {
      index,
      config: {
        loginMethod: 'channels_helper' as LoginMethod,
        loginWay: globalLoginWay.value, // 使用全局上号方式
        proxy: undefined,
        groupId: undefined,
        groupName: undefined,
        remark: ''
      },
      state: 'config' as AccountCreateState,
      progress: 0
    };
  }

  // 账号列表（初始化时创建第一个账号）
  const accounts = ref<AccountCreateItem[]>([createEmptyAccount(0)]);

  /**
   * 添加账号
   */
  function addAccount() {
    if (accounts.value.length >= 10) {
      notification.warning('最多只能同时添加 10 个账号');
      return;
    }
    const newIndex = accounts.value.length;
    accounts.value.push(createEmptyAccount(newIndex));
  }

  /**
   * 移除账号
   */
  function removeAccount(index: number) {
    if (accounts.value.length <= 1) {
      notification.warning('至少需要保留一个账号');
      return;
    }
    accounts.value.splice(index, 1);
    // 更新索引
    accounts.value.forEach((acc, i) => {
      acc.index = i;
    });
  }

  /**
   * 验证配置
   */
  function validateConfigs(): boolean {
    for (const account of accounts.value) {
      if (!account.config.groupId) {
        notification.error(`账号 #${account.index + 1} 未选择分组`);
        return false;
      }
    }
    return true;
  }

  /**
   * 下一步
   */
  async function goNext() {
    if (currentStep.value === 0) {
      // 配置 → 登录
      if (!validateConfigs()) {
        return;
      }
      // 先进入二维码页面
      currentStep.value = 1;
      // 然后在后台逐个生成二维码
      generateQRCodes();
    } else if (currentStep.value === 1) {
      // 登录 → 完成（自动进入，无需手动点击）
    } else if (currentStep.value === 2) {
      // 完成 → 关闭
      return true; // 通知父组件关闭
    }
  }

  /**
   * 批量创建链接上号的浏览器（用户确认后调用）
   * ⚠️ 已废弃：在新流程中，浏览器已在 generatePermanentLink 中创建
   */
  // async function createLinkAccountBrowsers() {
  //   console.log('[链接上号] 浏览器已在生成链接时创建，无需再次创建');
  // }

  /**
   * 强制完成（跳过未完成的账号）
   */
  async function forceComplete() {
    // 将所有还在处理中的账号标记为失败
    // 注意：链接上号的浏览器已在 generatePermanentLink 中创建，无需额外处理
    accounts.value.forEach(account => {
      if (account.state !== 'success' && account.state !== 'failed') {
        account.state = 'failed';
        account.errorMsg = '用户跳过';
      }
    });

    // 立即进入完成步骤
    currentStep.value = 2;
  }

  /**
   * 上一步
   */
  function goBack() {
    if (currentStep.value > 0) {
      // 停止所有 Realtime 订阅
      stopAllRealtimeSubscriptions();

      currentStep.value--;
      // 重置所有账号状态
      accounts.value.forEach(account => {
        account.state = 'config';
        account.qrUrl = undefined;
        account.progress = 0;
        account.errorMsg = undefined;
        account.wechatToken = undefined;
        account.browserId = undefined;
        account.permanentLink = undefined;
        account.linkQrCode = undefined;
      });
    }
  }

  /**
   * 生成单个账号的二维码（扫码上号）
   * 流程：生成虚拟ID → 调用云端API → 显示二维码 → 订阅Realtime
   */
  async function generateSingleQRCode(index: number) {
    let account = accounts.value[index];
    if (!account) return;

    try {
      account.state = 'qr_ready';
      account.progress = 10;

      console.log(`[扫码登录] 账号 #${index + 1} 生成虚拟ID并调用云端API`);

      // 1. 生成虚拟browserId（UUID）
      const virtualBrowserId = crypto.randomUUID();
      account.browserId = virtualBrowserId; // 暂存虚拟ID
      account.isVirtual = true; // 标记为虚拟ID

      console.log(`[扫码登录] 账号 #${index + 1} 虚拟ID: ${virtualBrowserId}`);

      // 2. 调用云端API生成链接和二维码
      const result = await CloudService.generatePermanentLink(
        virtualBrowserId,
        account.config.loginMethod,
        account.config
      );

      // 重新获取账号引用
      account = accounts.value[index];
      if (!account) {
        console.error(`账号 #${index + 1} 不存在，跳过`);
        return;
      }

      // 3. 保存二维码信息（loginQrUrl是微信登录二维码）
      account.qrUrl = result.loginQrUrl;
      account.permanentLink = result.url; // 也保存永久链接，方便后续查看
      account.qrExpireTime = Date.now() + 5 * 60 * 1000; // 前端倒计时5分钟

      console.log(`[扫码登录] 账号 #${index + 1} 二维码已生成`);

      account.state = 'waiting_scan';
      account.progress = 30;

      // 移除单个二维码生成成功通知，避免通知过多
      // notification.success(`账号 #${index + 1} 二维码已生成`);

      // 4. 确保账号被 AccountMonitorService 订阅（统一订阅管理），并注册直接回调
      const subscribed = AccountMonitorService.ensureSubscribed(virtualBrowserId, handleRealtimePush);

      if (!subscribed) {
        // 未配置 Supabase，清理云端链接
        account.state = 'failed';
        account.errorMsg = 'Supabase 未配置';
        notification.error('Supabase 未配置，请查看 REALTIME_SETUP.md 配置文档');
        await CloudService.deletePermanentLink(virtualBrowserId);
        return;
      }

      console.log(`[扫码登录] 账号 #${index + 1} 已通过 AccountMonitorService 订阅（含直接回调） ⚡`);

      // 5. 启动轮询（调用云端API检测登录状态，更新数据库）
      startPolling(virtualBrowserId);

      // 6. 订阅成功后，立即查询一次当前状态（防止订阅前状态已变化）
      // 状态变化会通过 Realtime 推送到 handleRealtimePush 直接处理
      try {
        const status = await CloudService.checkLinkStatus(virtualBrowserId);
        console.log(`[扫码登录] 初始状态查询: scanned=${status.scanned}, confirmed=${status.confirmed}`);
        // 状态已通过 checkLinkStatus 更新到数据库，Realtime 会自动推送到 handleRealtimePush
      } catch (error) {
        console.error(`[扫码登录] 初始状态查询失败:`, error);
      }

    } catch (error) {
      console.error(`账号 #${index + 1} 生成二维码失败:`, error);
      // 重新获取账号引用
      account = accounts.value[index];
      if (account) {
        account.state = 'failed';
        account.errorMsg = String(error);
      }
      notification.error(`账号 #${index + 1} 生成二维码失败: ${error}`);
    }
  }

  // ✅ 轮询定时器管理
  const pollingTimers = new Map<string, NodeJS.Timeout>();
  // ✅ AbortController 管理（用于取消飞行中的请求）
  const pollingControllers = new Map<string, AbortController>();

  /**
   * 启动轮询检测登录状态（调用云端API）
   * 轮询的作用：调用云端API检测登录状态 → API更新数据库 → Realtime推送到前端
   */
  function startPolling(browserId: string) {
    const key = `polling_${browserId}`;

    // 防止重复启动
    if (pollingTimers.has(key)) {
      console.log(`[Polling] ${browserId} 已在轮询中`);
      return;
    }

    // 创建 AbortController，用于取消请求
    const controller = new AbortController();
    pollingControllers.set(key, controller);

    console.log(`[Polling] 启动轮询 (0.2秒/次): ${browserId}`);

    const POLL_INTERVAL = 200;  // 降低到 200ms，提升响应速度

    async function pollStatus() {
      // 检查是否已被取消
      if (controller.signal.aborted) {
        return;
      }

      try {
        // 调用云端API检测状态（API会更新数据库），传入 signal 以支持取消
        const status = await CloudService.checkLinkStatus(browserId, controller.signal);

        // 再次检查是否已被取消（防止在等待响应期间被取消）
        if (controller.signal.aborted) {
          return;
        }

        // 打印详细的API返回状态 (V2 简化版)
        console.log(`[Polling] ${browserId} 状态:`, {
          scanned: status.scanned,
          confirmed: status.confirmed,
          expired: status.expired,
          success: status.success,
          nickname: status.nickname || '无',
          cookies: status.cookies ? `${status.cookies.length}个` : '无'
        });

        // 轮询只负责调用API，状态变化由Realtime推送
        // 如果状态变为完成或过期，停止轮询 (V2 使用布尔值判断)
        if (status.confirmed || status.expired) {
          console.log(`[Polling] 状态${status.confirmed ? '完成' : '过期'}，停止轮询: ${browserId}`);
          stopPolling(browserId);
        }
      } catch (error: any) {
        // 请求被取消（正常情况），静默处理
        if (error.name === 'CanceledError' || error.name === 'AbortError') {
          console.log(`[Polling] 请求已取消: ${browserId}`);
          return;
        }
        console.error(`[Polling] 检测失败: ${browserId}`, error);
      }
    }

    // 立即执行第一次轮询
    pollStatus();

    // 启动定时器
    const timer = setInterval(() => {
      pollStatus();
    }, POLL_INTERVAL);

    pollingTimers.set(key, timer);
  }

  /**
   * 停止轮询
   * ✅ 同时取消所有飞行中的请求
   */
  function stopPolling(browserId: string) {
    const key = `polling_${browserId}`;

    // 1. 取消所有飞行中的请求
    const controller = pollingControllers.get(key);
    if (controller) {
      controller.abort();
      pollingControllers.delete(key);
      console.log(`[Polling] 已取消飞行中的请求: ${browserId}`);
    }

    // 2. 清除定时器
    const timer = pollingTimers.get(key);
    if (timer) {
      clearInterval(timer);
      pollingTimers.delete(key);
      console.log(`[Polling] 停止轮询: ${browserId}`);
    }
  }

  /**
   * 生成所有二维码（串行，避免 API 限制）
   */
  async function generateQRCodes() {
    isProcessing.value = true;

    // 串行生成，避免触发 API 限流
    for (let i = 0; i < accounts.value.length; i++) {
      const account = accounts.value[i];

      if (account.config.loginWay === 'qr_code') {
        // 扫码上号：本地生成二维码
        await generateSingleQRCode(i);
      } else {
        // 链接上号：生成永久链接
        await generatePermanentLink(i);
      }

      // 添加短暂延迟，进一步降低触发限流的风险
      if (i < accounts.value.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    isProcessing.value = false;
  }

  /**
   * 生成永久链接（链接上号）
   * 流程：先创建空浏览器 → 用 browserId 生成链接 → 订阅 Realtime
   */
  async function generatePermanentLink(index: number) {
    let account = accounts.value[index];
    if (!account) return;

    try {
      account.state = 'qr_ready';
      account.progress = 10;

      console.log(`[链接上号] 账号 #${index + 1} 开始创建空浏览器`);

      // 1. 先创建空浏览器（不传Cookie）- 应用限流器
      const browserResult = await apiLimiter.runInternal(() =>
        invoke<CreateBrowserResult>('create_browser_with_account', {
          config: account.config,
          cookie: '', // 空Cookie，等待后续同步
          nickname: undefined // 不传昵称，使用序号
        })
      );

      if (!browserResult.success) {
        account.state = 'failed';
        account.errorMsg = browserResult.message || '创建浏览器失败';
        notification.error(`账号 #${index + 1} 创建浏览器失败: ${browserResult.message}`);
        return;
      }

      account.browserId = browserResult.browserId;
      account.progress = 30;

      console.log(`[链接上号] 账号 #${index + 1} 浏览器已创建: ${account.browserId}`);

      // 2. 用 browserId 生成永久链接
      const result = await CloudService.generatePermanentLink(
        account.browserId,
        account.config.loginMethod,
        account.config
      );

      // 重新获取账号引用
      account = accounts.value[index];
      if (!account) return;

      account.permanentLink = result.url;
      account.linkQrCode = result.qrCode;
      account.linkStatus = 'waiting';

      // 链接生成后，保持在 waiting_scan 状态，等待用户复制链接
      account.state = 'waiting_scan';
      account.progress = 50;

      console.log(`[链接上号] 账号 #${index + 1} 永久链接已生成: ${result.url}`);

      // 3. 确保账号被 AccountMonitorService 订阅（统一订阅管理），并注册直接回调
      const subscribed = AccountMonitorService.ensureSubscribed(account.browserId, handleRealtimePush);

      if (!subscribed) {
        // 未配置 Supabase，清理云端链接
        account.state = 'failed';
        account.errorMsg = 'Supabase 未配置';
        notification.error('Supabase 未配置，请查看 REALTIME_SETUP.md 配置文档');
        await CloudService.deletePermanentLink(account.browserId);
        return;
      }

      console.log(`[链接上号] 账号 #${index + 1} 已通过 AccountMonitorService 订阅（含直接回调） ⚡`);

      // 4. 订阅成功后，立即查询一次当前状态（防止订阅前状态已变化）
      // 状态变化会通过 Realtime 推送到 handleRealtimePush 直接处理
      try {
        const status = await CloudService.checkLinkStatus(account.browserId);
        console.log(`[链接上号] 初始状态查询: scanned=${status.scanned}, confirmed=${status.confirmed}`);
        // 状态已通过 checkLinkStatus 更新到数据库，Realtime 会自动推送到 handleRealtimePush
      } catch (error) {
        console.error(`[链接上号] 初始状态查询失败:`, error);
      }

      // ⚠️ 链接上号不在此处保存本地配置
      // 原因：避免用户未登录就关闭应用，导致本地有配置但云端无记录的情况
      // 改为：登录成功后（handleLoginCompleted）才保存到本地配置

      // 移除单个链接生成成功通知，避免通知过多
      // notification.success(`账号 #${index + 1} 永久链接已生成，请复制发送给账号所有者`);
    } catch (error) {
      console.error(`账号 #${index + 1} 生成永久链接失败:`, error);
      account = accounts.value[index];
      if (account) {
        account.state = 'failed';
        account.errorMsg = String(error);
      }
      notification.error(`账号 #${index + 1} 生成永久链接失败: ${error}`);
    }
  }

  /**
   * 创建浏览器（智能处理Cookie）- 用于链接上号
   * ⚠️ 已废弃：在新流程中，浏览器已在 generatePermanentLink 中提前创建
   *
   * 新流程：
   * 1. generatePermanentLink → 创建空浏览器 → 生成链接 → 订阅 Realtime
   * 2. 用户扫码 → Realtime 推送 Cookie → handleLoginCompleted 同步 Cookie
   *
   * 旧流程（已废弃）：
   * 1. generatePermanentLink → 生成链接（不创建浏览器） → 订阅 Realtime
   * 2. 用户点击确认 → createBrowserWithoutCookie → 创建浏览器
   */
  // async function createBrowserWithoutCookie(index: number) {
  //   console.log('[链接上号] 浏览器已在 generatePermanentLink 中创建');
  // }


  /**
   * 处理登录完成逻辑
   * - 扫码上号（虚拟ID）：创建真实浏览器 → 替换云端记录
   * - 链接上号（真实ID）：直接同步Cookie到已有浏览器
   */
  async function handleLoginCompleted(account: AccountCreateItem, data: any) {
    // ✅ 去重检查：防止重复处理同一 browserId
    if (processedBrowserIds.has(data.browserId)) {
      console.log(`[登录完成] browserId ${data.browserId} 已处理，忽略重复推送`);
      return;
    }
    processedBrowserIds.add(data.browserId);

    // ✅ 立即更新状态并强制渲染 UI
    account.state = 'creating';
    account.progress = 70;
    await nextTick();  // 强制立即更新 UI

    // ✅ 保存 syncResult 到外层作用域，供后续使用
    let syncResult: any = null;

    try {
      // 从云端同步最新的 Cookie 和账号信息
      console.log(`[登录完成] 从云端同步Cookie: ${data.browserId}`);
      syncResult = await CloudService.syncCookieFromCloud(data.browserId);

      account.accountInfo = {
        nickname: syncResult.nickname || data.nickname || '未知用户',
        avatar: syncResult.avatar || data.avatar || ''
      };

      if (syncResult.cookies) {
        account.cookie = syncResult.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
      }
    } catch (error) {
      console.error(`[登录完成] 同步Cookie失败:`, error);
      // 使用传入的数据作为后备
      account.accountInfo = {
        nickname: data.nickname || '未知用户',
        avatar: data.avatar || ''
      };
      if (data.cookies) {
        account.cookie = data.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
      }
    }

    // 移除中间通知，只保留最终成功/失败通知
    console.log(`[登录完成] 账号 #${account.index + 1} 登录成功: ${data.nickname}，正在创建浏览器...`);

    try {
      const virtualBrowserId = account.browserId; // 保存虚拟ID
      let realBrowserId = virtualBrowserId;
      const isVirtual = account.isVirtual; // ✅ 提前保存虚拟ID标记

      // 判断是否是扫码上号（虚拟ID）
      if (isVirtual) {
        console.log(`[扫码上号] 检测到虚拟ID，创建真实浏览器: ${virtualBrowserId}`);

        // ✅ 先停止轮询，避免后续删除记录后轮询出现404
        stopPolling(virtualBrowserId);

        // 1. 创建真实浏览器（带Cookie）- 应用限流器
        const result = await apiLimiter.runInternal(() =>
          invoke<CreateBrowserResult>('create_browser_with_account', {
            config: account.config,
            cookie: account.cookie,
            nickname: data.nickname
          })
        );

        if (!result.success) {
          account.state = 'failed';
          account.errorMsg = result.message || '创建浏览器失败';
          notification.error(`账号 #${account.index + 1} 创建浏览器失败: ${result.message}`);
          // 删除虚拟记录（订阅由 AccountMonitorService 统一管理）
          await CloudService.deletePermanentLink(virtualBrowserId);
          return;
        }

        realBrowserId = result.browserId;
        account.browserId = realBrowserId;
        account.isVirtual = false;

        console.log(`[扫码上号] 真实浏览器已创建: ${realBrowserId}`);

        // 2. 删除虚拟记录，用真实ID创建新记录（带Cookie）
        // 注意：订阅由 AccountMonitorService 统一管理，不在此处取消
        await CloudService.deletePermanentLink(virtualBrowserId);

        // ✅ 使用 syncResult.cookies 而不是 data.cookies（更完整可靠）
        const cookiesForRegister = syncResult?.cookies || data.cookies || [];
        const registerResult = await CloudService.autoRegisterBrowser(
          realBrowserId,
          cookiesForRegister,
          account.config.loginMethod,
          {
            nickname: account.accountInfo.nickname,
            avatar: account.accountInfo.avatar
          }
        );

        if (!registerResult) {
          console.error(`[扫码上号] 注册浏览器失败: ${realBrowserId}`);
          // 注册失败不影响主流程，浏览器已创建，只是云端状态监控会受影响
        }

        console.log(`[扫码上号] 云端记录已更新: ${virtualBrowserId} → ${realBrowserId}`);
      } else {
        // 链接上号：同步Cookie到已有浏览器 - 应用限流器
        console.log(`[链接上号] 同步Cookie到已有浏览器: ${realBrowserId}`);

        await apiLimiter.runInternal(() =>
          invoke('sync_cookie_to_browser', {
            browserId: realBrowserId,
            cookie: account.cookie,
            nickname: account.accountInfo.nickname,
            avatar: account.accountInfo.avatar
          })
        );
      }

      // ✅ 立即更新状态并强制渲染 UI
      account.state = 'success';
      account.progress = 100;
      await nextTick();  // 强制立即更新 UI

      // 更新账号信息到本地
      const accountData: Cookie.AccountData = {
        accountInfo: account.accountInfo,
        loginMethod: data.loginMethod || account.config.loginMethod,
        loginTime: Date.now(),
        updatedAt: new Date().toISOString(),
        browserId: realBrowserId
      };

      await configStore.saveBrowserAccount(realBrowserId, accountData);

      // ✅ 更新 browserStore 的内存数据，确保 AccountCard UI 立即刷新
      const { useBrowserStore } = await import('@/store/modules/browser');
      const browserStore = useBrowserStore();
      browserStore.updateAccountInfo(realBrowserId, account.accountInfo);

      // 确保订阅真实ID（不会初始化pending缓存）
      AccountMonitorService.ensureSubscribed(realBrowserId);

      // ✅ 主动查询一次最新状态，填充缓存
      // 如果虚拟ID的订阅还在，查询时会自动清理（404 → 取消订阅）
      await AccountMonitorService.refreshAccountStatus(realBrowserId);

      // 停止轮询（使用虚拟ID，仅扫码上号）
      stopPolling(virtualBrowserId);

      // 单个账号创建成功，不显示通知（统一由 checkAllComplete 显示汇总通知）
      console.log(`[Realtime-全局] 账号 #${account.index + 1} 完成: ${data.nickname}`);

      // 检查是否所有账号都完成
      checkAllComplete();
    } catch (error) {
      console.error(`[Realtime-全局] 处理失败:`, error);
      account.state = 'failed';
      account.errorMsg = String(error);
      notification.error(`账号 #${account.index + 1} 处理失败: ${error}`);
    }
  }

  /**
   * 停止所有轮询（清理资源）
   * 注意：Realtime 订阅由 AccountMonitorService 统一管理，不在此处取消
   */
  function stopAllRealtimeSubscriptions() {
    console.log('[Realtime] 停止所有轮询');

    accounts.value.forEach(account => {
      if (account.browserId) {
        // 停止轮询（扫码上号）
        if (account.config.loginWay === 'qr_code') {
          stopPolling(account.browserId);
        }
      }
    });

    console.log('[Realtime] 清理完成');
  }

  /**
   * 清理未使用的云端链接
   *
   * ⚠️ 清理规则：
   * - 扫码上号（虚拟ID）：只要不是 'success'，就清理虚拟记录（浏览器未创建）
   * - 链接上号（真实ID）：永远不清理（浏览器已创建，链接可继续使用）
   *
   * 调用时机：用户关闭添加账号页面时
   */
  async function cleanupUnusedLinks() {
    console.log('[链接清理] 检查需要清理的云端链接');

    // 需要清理的账号列表
    const accountsToCleanup = accounts.value.filter(account => {
      if (!account.browserId) {
        return false;
      }

      // 扫码上号（虚拟ID）：只要不是成功状态，就清理（浏览器未创建）
      if (account.isVirtual && account.state !== 'success') {
        return true;
      }

      // 链接上号（真实ID）：永远不清理（浏览器已创建，链接可继续使用）
      // 即使用户点"强制完成"或"关闭"，链接记录也保留在云端
      return false;
    });

    if (accountsToCleanup.length === 0) {
      console.log('[链接清理] 没有需要清理的云端链接');
      return;
    }

    console.log(`[链接清理] 发现 ${accountsToCleanup.length} 个账号需要清理`);

    // 停止轮询（订阅由 AccountMonitorService 统一管理）
    accountsToCleanup.forEach(account => {
      if (account.browserId) {
        stopPolling(account.browserId);
        console.log(`[链接清理] 停止轮询: ${account.browserId} (虚拟ID: ${account.isVirtual ? '是' : '否'})`);
      }
    });

    // 并发删除云端链接
    const deletePromises = accountsToCleanup.map(account => {
      console.log(`[链接清理] 删除云端链接: ${account.browserId} (虚拟ID: ${account.isVirtual ? '是' : '否'})`);
      return CloudService.deletePermanentLink(account.browserId);
    });

    const results = await Promise.all(deletePromises);
    const successCount = results.filter(r => r).length;

    console.log(`[链接清理] 完成，成功删除 ${successCount}/${accountsToCleanup.length} 个云端链接`);
  }

  /**
   * 重新生成二维码
   */
  async function regenerateQRCode(index: number) {
    const account = accounts.value[index];

    if (!account) {
      console.warn(`账号 #${index + 1} 不存在，无法重新生成二维码`);
      return;
    }

    // 清理云端链接（订阅由 AccountMonitorService 统一管理）
    if (account.browserId) {
      await CloudService.deletePermanentLink(account.browserId);
    }

    // 重置状态
    account.state = 'config';
    account.progress = 0;
    account.errorMsg = undefined;
    account.qrUrl = undefined;
    account.wechatToken = undefined;
    account.browserId = undefined;
    account.permanentLink = undefined;
    account.linkQrCode = undefined;

    // 重新生成（根据上号方式调用对应逻辑）
    if (account.config.loginWay === 'qr_code') {
      await generateSingleQRCode(index);
    } else {
      await generatePermanentLink(index);
    }
  }


  /**
   * 检查是否所有账号都完成
   */
  function checkAllComplete() {
    const allDone = accounts.value.every(
      acc => acc.state === 'success' || acc.state === 'failed'
    );

    if (allDone) {
      const successCount = accounts.value.filter(acc => acc.state === 'success').length;
      const failedCount = accounts.value.filter(acc => acc.state === 'failed').length;

      if (successCount > 0) {
        notification.success(`成功创建 ${successCount} 个账号${failedCount > 0 ? `，失败 ${failedCount} 个` : ''}`);
      }

      // 自动进入完成步骤
      setTimeout(() => {
        currentStep.value = 2;
      }, 1000);
    }
  }

  /**
   * 重试失败的账号
   */
  async function retryFailed(index: number) {
    const account = accounts.value[index];

    if (!account) {
      console.warn(`账号 #${index + 1} 不存在，无法重试`);
      return;
    }

    if (account.state !== 'failed') {
      return;
    }

    // 清理云端链接（订阅由 AccountMonitorService 统一管理）
    if (account.browserId) {
      await CloudService.deletePermanentLink(account.browserId);
    }

    // 重置状态
    account.state = 'config';
    account.progress = 0;
    account.errorMsg = undefined;
    account.qrUrl = undefined;
    account.cookie = undefined;
    account.wechatToken = undefined;
    account.browserId = undefined;
    account.permanentLink = undefined;
    account.linkQrCode = undefined;

    // 重新生成
    if (account.config.loginWay === 'qr_code') {
      await generateSingleQRCode(index);
    } else {
      await generatePermanentLink(index);
    }
  }

  // 计算属性
  const successCount = computed(() => accounts.value.filter(acc => acc.state === 'success').length);
  const failedCount = computed(() => accounts.value.filter(acc => acc.state === 'failed').length);
  const processingCount = computed(() =>
    accounts.value.filter(
      acc =>
        acc.state !== 'config' && acc.state !== 'success' && acc.state !== 'failed'
    ).length
  );

  return {
    // 状态
    currentStep,
    accounts,
    isProcessing,
    globalLoginWay, // ✅ 全局上号方式

    // 统计
    successCount,
    failedCount,
    processingCount,

    // 方法
    addAccount,
    removeAccount,
    goNext,
    goBack,
    forceComplete,
    regenerateQRCode,
    retryFailed,
    stopAllRealtimeSubscriptions,
    cleanupUnusedLinks
  };
}
