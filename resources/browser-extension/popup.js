/**
 * 视频号永久链接助手 - 弹出窗口脚本
 */

const statusEl = document.getElementById('status');
const browserIdEl = document.getElementById('browserId');
const pluginStatusEl = document.getElementById('pluginStatus');
const cookieStatusEl = document.getElementById('cookieStatus');
const checkBtn = document.getElementById('checkBtn');
const uploadBtn = document.getElementById('uploadBtn');

let config = null;

/**
 * 加载配置
 */
async function loadConfig() {
  try {
    const result = await chrome.storage.local.get(['browserId', 'apiEndpoint']);

    if (result.browserId) {
      config = {
        browserId: result.browserId,
        apiEndpoint: result.apiEndpoint || 'https://jsfjdcbfftuaynwkmjey.supabase.co/functions/v1/update-channels-cookie'
      };

      browserIdEl.textContent = result.browserId.substring(0, 12) + '...';
      pluginStatusEl.textContent = '已配置';

      updateStatus('success', '✅ 插件配置正常');
    } else {
      updateStatus('warning', '⚠️ 未检测到浏览器ID配置');
      pluginStatusEl.textContent = '未配置';
    }
  } catch (error) {
    console.error('加载配置失败:', error);
    updateStatus('error', '❌ 配置加载失败');
  }
}

/**
 * 更新状态显示
 */
function updateStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
}

/**
 * 检查Cookie状态
 */
async function checkCookies() {
  try {
    const cookies = await chrome.cookies.getAll({
      domain: '.weixin.qq.com'
    });

    const sessionid = cookies.find(c => c.name === 'sessionid');
    const wxuin = cookies.find(c => c.name === 'wxuin');

    if (sessionid && wxuin) {
      cookieStatusEl.textContent = '已检测到';
      uploadBtn.disabled = false;
      updateStatus('success', '✅ 检测到视频号Cookie');
      return { sessionid: sessionid.value, wxuin: wxuin.value };
    } else {
      cookieStatusEl.textContent = '未检测到';
      uploadBtn.disabled = true;
      updateStatus('warning', '⚠️ 未检测到视频号Cookie');
      return null;
    }
  } catch (error) {
    console.error('检查Cookie失败:', error);
    updateStatus('error', '❌ Cookie检查失败');
    return null;
  }
}

/**
 * 上传Cookie
 */
async function uploadCookies() {
  if (!config || !config.browserId) {
    updateStatus('error', '❌ 未配置浏览器ID');
    return;
  }

  updateStatus('warning', '⏳ 正在上传Cookie...');
  uploadBtn.disabled = true;

  try {
    const cookies = await checkCookies();

    if (!cookies) {
      updateStatus('warning', '⚠️ 未检测到Cookie');
      return;
    }

    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        browser_id: config.browserId,
        sessionid: cookies.sessionid,
        wxuin: cookies.wxuin
      })
    });

    const result = await response.json();

    if (result.success) {
      updateStatus('success', '✅ Cookie上传成功');
    } else {
      updateStatus('error', `❌ 上传失败: ${result.message}`);
    }
  } catch (error) {
    console.error('上传Cookie失败:', error);
    updateStatus('error', '❌ 上传失败，请稍后重试');
  } finally {
    uploadBtn.disabled = false;
  }
}

// 事件监听
checkBtn.addEventListener('click', checkCookies);
uploadBtn.addEventListener('click', uploadCookies);

// 初始化
loadConfig();
