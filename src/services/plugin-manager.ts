/**
 * 浏览器插件管理服务
 *
 * 功能：获取插件路径（支持开发和生产环境）
 *
 * 注意：插件通过 open_browser 的 --load-extension 参数动态加载
 * 不需要配置到浏览器的 extensions 字段中
 */

import { invoke } from '@tauri-apps/api/tauri';

/**
 * 插件管理服务
 */
export class PluginManagerService {
  private static pluginPath: string | null = null;

  /**
   * 获取插件路径
   *
   * 开发环境：toolbox/resources/browser-extension
   * 生产环境：安装目录/resources/browser-extension
   */
  static async getPluginPath(): Promise<string> {
    if (this.pluginPath) {
      return this.pluginPath;
    }

    try {
      // 从 Rust 端获取插件路径（Rust 端已做路径验证）
      const resourcePath = await invoke<string>('get_plugin_path');

      // 直接信任 Rust 端返回的路径，不做前端验证
      // （避免 Tauri 文件系统权限问题）
      this.pluginPath = resourcePath;
      console.log('[插件管理] 插件路径:', resourcePath);
      return resourcePath;
    } catch (error) {
      console.error('[插件管理] 获取插件路径失败:', error);
      throw error;
    }
  }
}
