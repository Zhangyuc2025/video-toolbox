/**
 * Tauri 应用更新工具
 * 提供版本检查、下载更新等功能
 */

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  releaseDate?: string;
}

/**
 * 检查是否在 Tauri 环境中运行
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * 检查更新
 * @returns 更新信息
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  // 如果不在 Tauri 环境，返回无更新
  if (!isTauriEnvironment()) {
    console.warn('当前不在 Tauri 环境中，无法检查更新');
    return {
      available: false,
      currentVersion: await getCurrentVersion()
    };
  }

  try {
    const { checkUpdate } = await import('@tauri-apps/api/updater');
    const { shouldUpdate, manifest } = await checkUpdate();

    if (!shouldUpdate || !manifest) {
      return {
        available: false,
        currentVersion: await getCurrentVersion()
      };
    }

    return {
      available: true,
      currentVersion: await getCurrentVersion(),
      latestVersion: manifest.version,
      releaseNotes: manifest.body || '无更新说明',
      releaseDate: manifest.date
    };
  } catch (error: any) {
    console.error('检查更新失败:', error);
    // 如果是网络错误或服务器错误，给出更友好的提示
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      throw new Error('网络连接失败，请检查网络后重试');
    }
    throw new Error('无法检查更新，请稍后重试');
  }
}

/**
 * 下载并安装更新
 * @param onProgress 下载进度回调 (0-100)
 */
export async function downloadAndInstall(
  onProgress?: (progress: number) => void
): Promise<void> {
  if (!isTauriEnvironment()) {
    throw new Error('当前环境不支持更新功能');
  }

  try {
    const { installUpdate, onUpdaterEvent } = await import('@tauri-apps/api/updater');
    const { relaunch } = await import('@tauri-apps/api/process');

    let downloadError: string | null = null;

    // 监听更新事件
    const unlisten = await onUpdaterEvent(({ error, status }) => {
      if (error) {
        console.error('更新错误:', error);
        downloadError = error;
        return;
      }

      // 更新状态
      if (status === 'PENDING') {
        console.log('开始下载更新...');
        onProgress?.(0);
      } else if (status === 'DOWNLOADING') {
        console.log('正在下载更新...');
        // Tauri 不提供具体进度，这里平滑过渡
        onProgress?.(50);
      } else if (status === 'DOWNLOADED') {
        console.log('下载完成，准备安装...');
        onProgress?.(90);
      }
    });

    try {
      // 下载并安装更新
      await installUpdate();

      // 检查是否有错误
      if (downloadError) {
        throw new Error(downloadError);
      }

      onProgress?.(100);

      // 清理监听器
      unlisten();

      // 延迟重启，让用户看到完成提示
      setTimeout(async () => {
        await relaunch();
      }, 1000);
    } catch (error) {
      unlisten();
      throw error;
    }
  } catch (error: any) {
    console.error('安装更新失败:', error);
    throw new Error(error.message || '更新安装失败，请稍后重试');
  }
}

/**
 * 获取当前版本号
 */
export async function getCurrentVersion(): Promise<string> {
  // 如果不在 Tauri 环境，返回默认版本
  if (!isTauriEnvironment()) {
    return '1.0.0 (开发环境)';
  }

  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    const version = await getVersion();
    return version || '1.0.0';
  } catch (error) {
    console.error('获取版本号失败:', error);
    return '1.0.0';
  }
}

/**
 * 静默检查更新（应用启动时调用）
 * 如果有更新，显示通知
 */
export async function silentCheckUpdate(): Promise<void> {
  try {
    const updateInfo = await checkForUpdates();

    if (updateInfo.available) {
      console.log(`发现新版本: ${updateInfo.latestVersion}`);
      // 可以在这里触发通知或弹窗
      // 注意：不要在这里直接安装更新，应该让用户确认
    }
  } catch (error) {
    // 静默失败，不影响应用启动
    console.warn('后台检查更新失败:', error);
  }
}

/**
 * 显示更新对话框并处理用户选择
 * @param updateInfo 更新信息
 */
export async function showUpdateDialog(updateInfo: UpdateInfo): Promise<boolean> {
  if (!updateInfo.available) {
    return false;
  }

  // 这里需要根据你的 UI 框架显示对话框
  // 以下是一个简单的浏览器原生对话框示例
  const message = `
发现新版本：${updateInfo.latestVersion}
当前版本：${updateInfo.currentVersion}

更新内容：
${updateInfo.releaseNotes}

是否立即更新？
  `.trim();

  return window.confirm(message);
}

/**
 * 完整的更新流程（推荐使用）
 * 1. 检查更新
 * 2. 显示对话框
 * 3. 下载安装
 * 4. 重启应用
 */
export async function performUpdate(
  onProgress?: (progress: number, message: string) => void
): Promise<void> {
  try {
    // 1. 检查更新
    onProgress?.(0, '正在检查更新...');
    const updateInfo = await checkForUpdates();

    if (!updateInfo.available) {
      onProgress?.(100, '当前已是最新版本');
      return;
    }

    // 2. 询问用户
    onProgress?.(20, '发现新版本');
    const confirmed = await showUpdateDialog(updateInfo);

    if (!confirmed) {
      onProgress?.(100, '用户取消更新');
      return;
    }

    // 3. 下载并安装
    onProgress?.(30, '开始下载更新...');
    await downloadAndInstall((progress) => {
      const mappedProgress = 30 + (progress * 0.7); // 30-100
      onProgress?.(mappedProgress, `下载中 ${progress}%`);
    });

    onProgress?.(100, '更新完成，即将重启...');
  } catch (error: any) {
    console.error('更新失败:', error);
    throw new Error(error.message || '更新失败，请稍后重试');
  }
}
