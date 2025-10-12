/**
 * 统一的通知工具
 * 集中管理所有通知样式和配置
 */

import type { MessageOptions, DialogOptions, NotificationOptions } from 'naive-ui';

/**
 * 全局通知样式配置
 * 在这里修改样式，所有通知都会生效
 */
const NOTIFICATION_CONFIG = {
  message: {
    duration: 3000, // 默认显示时长 (毫秒)
    keepAliveOnHover: true, // 鼠标悬停时保持显示
    closable: true, // 显示关闭按钮
    maxCount: 5 // 最大显示数量
  },
  notification: {
    duration: 1500, // 显示时间1.5秒
    keepAliveOnHover: true,
    closable: true,
    maxCount: 3,
    placement: 'bottom-right' as const // 右下角显示位置
  },
  dialog: {
    maskClosable: false, // 点击遮罩不关闭
    closeOnEsc: true // 按 ESC 关闭
  }
} as const;

/**
 * 消息提示类型
 */
type MessageType = 'success' | 'error' | 'warning' | 'info' | 'loading';

/**
 * 消息提示选项
 */
interface MessageConfig extends Partial<MessageOptions> {
  duration?: number;
  closable?: boolean;
  keepAliveOnHover?: boolean;
}

/**
 * 通知选项
 */
interface NotificationConfig extends Partial<NotificationOptions> {
  title?: string;
  duration?: number;
  closable?: boolean;
  placement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/**
 * 对话框选项
 */
interface DialogConfig extends Partial<DialogOptions> {
  title: string;
  content: string;
  positiveText?: string;
  negativeText?: string;
  onPositiveClick?: () => void | Promise<void>;
  onNegativeClick?: () => void | Promise<void>;
}

/**
 * 消息提示 - 轻量级提示
 */
export const message = {
  /**
   * 成功提示
   */
  success(content: string, options?: MessageConfig) {
    return window.$message?.success(content, {
      duration: NOTIFICATION_CONFIG.message.duration,
      closable: NOTIFICATION_CONFIG.message.closable,
      keepAliveOnHover: NOTIFICATION_CONFIG.message.keepAliveOnHover,
      ...options
    });
  },

  /**
   * 错误提示
   */
  error(content: string, options?: MessageConfig) {
    return window.$message?.error(content, {
      duration: NOTIFICATION_CONFIG.message.duration,
      closable: NOTIFICATION_CONFIG.message.closable,
      keepAliveOnHover: NOTIFICATION_CONFIG.message.keepAliveOnHover,
      ...options
    });
  },

  /**
   * 警告提示
   */
  warning(content: string, options?: MessageConfig) {
    return window.$message?.warning(content, {
      duration: NOTIFICATION_CONFIG.message.duration,
      closable: NOTIFICATION_CONFIG.message.closable,
      keepAliveOnHover: NOTIFICATION_CONFIG.message.keepAliveOnHover,
      ...options
    });
  },

  /**
   * 信息提示
   */
  info(content: string, options?: MessageConfig) {
    return window.$message?.info(content, {
      duration: NOTIFICATION_CONFIG.message.duration,
      closable: NOTIFICATION_CONFIG.message.closable,
      keepAliveOnHover: NOTIFICATION_CONFIG.message.keepAliveOnHover,
      ...options
    });
  },

  /**
   * 加载提示
   */
  loading(content: string, options?: MessageConfig) {
    return window.$message?.loading(content, {
      duration: 0, // 加载提示默认不自动关闭
      ...options
    });
  },

  /**
   * 销毁所有消息
   */
  destroyAll() {
    window.$message?.destroyAll();
  }
};

/**
 * 通知 - 右下角通知（默认无标题，更简洁）
 */
export const notification = {
  /**
   * 成功通知
   * @param content - 通知内容
   * @param config - 配置项（可选，传入 title 则显示标题）
   */
  success(content: string, config?: NotificationConfig) {
    const { title, ...options } = config || {};
    return window.$notification?.success({
      title: title || undefined, // 不传 title 则不显示标题区域
      content,
      duration: NOTIFICATION_CONFIG.notification.duration,
      closable: NOTIFICATION_CONFIG.notification.closable,
      keepAliveOnHover: NOTIFICATION_CONFIG.notification.keepAliveOnHover,
      placement: NOTIFICATION_CONFIG.notification.placement,
      ...options
    });
  },

  /**
   * 错误通知
   * @param content - 通知内容
   * @param config - 配置项（可选，传入 title 则显示标题）
   */
  error(content: string, config?: NotificationConfig) {
    const { title, ...options } = config || {};
    return window.$notification?.error({
      title: title || undefined,
      content,
      duration: NOTIFICATION_CONFIG.notification.duration,
      closable: NOTIFICATION_CONFIG.notification.closable,
      keepAliveOnHover: NOTIFICATION_CONFIG.notification.keepAliveOnHover,
      placement: NOTIFICATION_CONFIG.notification.placement,
      ...options
    });
  },

  /**
   * 警告通知
   * @param content - 通知内容
   * @param config - 配置项（可选，传入 title 则显示标题）
   */
  warning(content: string, config?: NotificationConfig) {
    const { title, ...options } = config || {};
    return window.$notification?.warning({
      title: title || undefined,
      content,
      duration: NOTIFICATION_CONFIG.notification.duration,
      closable: NOTIFICATION_CONFIG.notification.closable,
      keepAliveOnHover: NOTIFICATION_CONFIG.notification.keepAliveOnHover,
      placement: NOTIFICATION_CONFIG.notification.placement,
      ...options
    });
  },

  /**
   * 信息通知
   * @param content - 通知内容
   * @param config - 配置项（可选，传入 title 则显示标题）
   */
  info(content: string, config?: NotificationConfig) {
    const { title, ...options } = config || {};
    return window.$notification?.info({
      title: title || undefined,
      content,
      duration: NOTIFICATION_CONFIG.notification.duration,
      closable: NOTIFICATION_CONFIG.notification.closable,
      keepAliveOnHover: NOTIFICATION_CONFIG.notification.keepAliveOnHover,
      placement: NOTIFICATION_CONFIG.notification.placement,
      ...options
    });
  },

  /**
   * 销毁所有通知
   */
  destroyAll() {
    window.$notification?.destroyAll();
  }
};

/**
 * 对话框
 */
export const dialog = {
  /**
   * 成功对话框
   */
  success(config: DialogConfig) {
    const { positiveText = '确定', ...options } = config;
    return window.$dialog?.success({
      maskClosable: NOTIFICATION_CONFIG.dialog.maskClosable,
      closeOnEsc: NOTIFICATION_CONFIG.dialog.closeOnEsc,
      positiveText,
      ...options
    });
  },

  /**
   * 错误对话框
   */
  error(config: DialogConfig) {
    const { positiveText = '确定', ...options } = config;
    return window.$dialog?.error({
      maskClosable: NOTIFICATION_CONFIG.dialog.maskClosable,
      closeOnEsc: NOTIFICATION_CONFIG.dialog.closeOnEsc,
      positiveText,
      ...options
    });
  },

  /**
   * 警告对话框
   */
  warning(config: DialogConfig) {
    const { positiveText = '确定', negativeText = '取消', ...options } = config;
    return window.$dialog?.warning({
      maskClosable: NOTIFICATION_CONFIG.dialog.maskClosable,
      closeOnEsc: NOTIFICATION_CONFIG.dialog.closeOnEsc,
      positiveText,
      negativeText,
      ...options
    });
  },

  /**
   * 信息对话框
   */
  info(config: DialogConfig) {
    const { positiveText = '确定', ...options } = config;
    return window.$dialog?.info({
      maskClosable: NOTIFICATION_CONFIG.dialog.maskClosable,
      closeOnEsc: NOTIFICATION_CONFIG.dialog.closeOnEsc,
      positiveText,
      ...options
    });
  },

  /**
   * 确认对话框
   */
  confirm(config: DialogConfig) {
    const { positiveText = '确定', negativeText = '取消', ...options } = config;
    return window.$dialog?.warning({
      maskClosable: NOTIFICATION_CONFIG.dialog.maskClosable,
      closeOnEsc: NOTIFICATION_CONFIG.dialog.closeOnEsc,
      positiveText,
      negativeText,
      ...options
    });
  }
};

/**
 * 加载条
 */
export const loadingBar = {
  start() {
    window.$loadingBar?.start();
  },
  finish() {
    window.$loadingBar?.finish();
  },
  error() {
    window.$loadingBar?.error();
  }
};

/**
 * 默认导出 - 简化调用
 */
export default {
  message,
  notification,
  dialog,
  loadingBar
};
