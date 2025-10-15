/**
 * 视频号永久链接助手 - 后台服务脚本
 *
 * 功能（待实现）：
 * 1. 检测小店登录，自动跳转视频号
 * 2. 提取视频号Cookie（sessionid + wxuin）
 * 3. 上传Cookie到云端
 */

console.log('[永久链接助手] 插件已加载');

// 插件配置（将由Toolbox注入到localStorage）
let config = {
  browserId: null,
  apiEndpoint: 'https://jsfjdcbfftuaynwkmjey.supabase.co/functions/v1/update-channels-cookie',
  enabled: true
};

/**
 * 初始化插件配置
 */
async function initConfig() {
  try {
    // 从chrome.storage读取配置（由Toolbox写入）
    const result = await chrome.storage.local.get(['browserId', 'apiEndpoint']);

    if (result.browserId) {
      config.browserId = result.browserId;
      console.log('[永久链接助手] 配置已加载:', { browserId: config.browserId });
    } else {
      console.warn('[永久链接助手] 未找到browserId配置');
    }

    if (result.apiEndpoint) {
      config.apiEndpoint = result.apiEndpoint;
    }
  } catch (error) {
    console.error('[永久链接助手] 配置加载失败:', error);
  }
}

/**
 * 提取Cookie
 * （待实现）
 */
async function extractCookies() {
  try {
    const cookies = await chrome.cookies.getAll({
      domain: '.weixin.qq.com'
    });

    const sessionid = cookies.find(c => c.name === 'sessionid')?.value;
    const wxuin = cookies.find(c => c.name === 'wxuin')?.value;

    if (sessionid && wxuin) {
      console.log('[永久链接助手] Cookie提取成功');
      return { sessionid, wxuin };
    }

    return null;
  } catch (error) {
    console.error('[永久链接助手] Cookie提取失败:', error);
    return null;
  }
}

/**
 * 上传Cookie到云端（旧版本，使用配置中的browserId）
 * （待实现）
 */
async function uploadCookies(sessionid, wxuin) {
  if (!config.browserId) {
    console.error('[永久链接助手] 未配置browserId，无法上传');
    return false;
  }

  try {
    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        browser_id: config.browserId,
        sessionid,
        wxuin
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('[永久链接助手] Cookie上传成功:', result);
      return true;
    } else {
      console.error('[永久链接助手] Cookie上传失败:', result);
      return false;
    }
  } catch (error) {
    console.error('[永久链接助手] Cookie上传异常:', error);
    return false;
  }
}

/**
 * 上传视频号Cookie到云端（新版本，支持browserId和owner参数）
 */
async function uploadChannelsCookie(browserId, owner, sessionid, wxuin) {
  if (!browserId) {
    console.error('[永久链接助手] browserId为空，无法上传');
    return false;
  }

  try {
    // 使用 Workers API 上传
    const apiUrl = 'https://link.yiguiwangluo.top/api/upload-channels-cookie';

    console.log('[永久链接助手] 准备上传Cookie到:', apiUrl);
    console.log('[永久链接助手] 参数:', { browserId, owner });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        browserId,
        owner,
        sessionid,
        wxuin
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[永久链接助手] API返回错误:', response.status, errorText);
      return false;
    }

    const result = await response.json();

    if (result.success) {
      console.log('[永久链接助手] Cookie上传成功:', result);
      return true;
    } else {
      console.error('[永久链接助手] Cookie上传失败:', result);
      return false;
    }
  } catch (error) {
    console.error('[永久链接助手] Cookie上传异常:', error);
    return false;
  }
}

/**
 * 监听标签页更新（检测登录状态）
 * （待实现）
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 只处理完成加载的标签页
  if (changeInfo.status !== 'complete') {
    return;
  }

  // 检查是否是视频号或小店页面
  const url = tab.url || '';

  if (url.includes('channels.weixin.qq.com') || url.includes('xms.weixin.qq.com')) {
    console.log('[永久链接助手] 检测到微信页面:', url);

    // TODO: 检测登录状态
    // TODO: 提取并上传Cookie
  }
});

/**
 * 监听来自content script的消息
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[永久链接助手] 收到消息:', message);

  if (message.type === 'COOKIE_DETECTED') {
    // Content script检测到Cookie（旧方式，兼容保留）
    const { sessionid, wxuin } = message.data;

    uploadCookies(sessionid, wxuin)
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        console.error('[永久链接助手] 处理消息失败:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // 保持消息通道打开
  }

  if (message.type === 'UPLOAD_CHANNELS_COOKIE') {
    // 新的Cookie上传方式（支持browserId和owner参数）
    const { browserId, owner, sessionid, wxuin } = message.data;

    console.log('[永久链接助手] 开始上传Cookie:', { browserId, owner });

    uploadChannelsCookie(browserId, owner, sessionid, wxuin)
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        console.error('[永久链接助手] Cookie上传失败:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // 保持消息通道打开
  }

  if (message.type === 'GET_CONFIG') {
    sendResponse({ config });
    return true;
  }
});

// 初始化
initConfig();
