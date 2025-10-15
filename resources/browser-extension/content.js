/**
 * 视频号永久链接助手 - 内容脚本
 *
 * 功能：
 * 1. 带货助手自动跳转到视频号
 * 2. 视频号自动跳转到带货助手
 */

console.log('[永久链接助手-Content] 内容脚本已注入');

// 配置：控制是否自动跳转
const AUTO_JUMP_CONFIG = {
  shopToChannels: true,  // 带货助手 → 视频号
  channelsToShop: true   // 视频号 → 带货助手
};

// 存储键：避免重复跳转（使用localStorage跨标签页共享）
const STORAGE_KEY_LAST_JUMP = 'plugin_last_jump_time';
const JUMP_COOLDOWN = 10000; // 10秒内不重复跳转

/**
 * 检测当前页面类型
 */
function detectPageType() {
  const url = window.location.href;

  if (url.includes('store.weixin.qq.com/talent')) {
    return 'shop_page';
  }

  if (url.includes('channels.weixin.qq.com/platform')) {
    return 'channels_page';
  }

  return null;
}

/**
 * 检查是否应该跳转（防止循环跳转）
 *
 * 判断逻辑：
 * 1. 如果URL带了 external_token 参数，说明是从带货助手跳转过来的 → 不跳转
 * 2. 如果10秒内已经跳转过 → 不跳转
 */
function shouldJump() {
  // 检查URL参数
  const url = new URL(window.location.href);
  const hasExternalToken = url.searchParams.has('external_token');

  if (hasExternalToken) {
    console.log('[跳转] 检测到URL带external_token参数，是跳转而来，不再二次跳转');
    return false;
  }

  // 检查最后跳转时间（使用localStorage跨标签页共享）
  const lastJumpTime = localStorage.getItem(STORAGE_KEY_LAST_JUMP);

  if (lastJumpTime) {
    const timeSinceLastJump = Date.now() - parseInt(lastJumpTime);

    if (timeSinceLastJump < JUMP_COOLDOWN) {
      console.log(`[跳转] ${Math.floor(timeSinceLastJump / 1000)}秒前刚跳转过，冷却中，不再跳转`);
      return false;
    }
  }

  return true;
}

/**
 * 记录跳转时间
 */
function recordJumpTime() {
  localStorage.setItem(STORAGE_KEY_LAST_JUMP, Date.now().toString());
}

/**
 * 从Cookie检测登录方式
 */
function detectLoginMethod() {
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {});

  // 判断登录方式
  const hasTalentToken = !!cookies.talent_token;
  const hasSessionId = !!cookies.sessionid;

  if (hasTalentToken) {
    console.log('[跳转] 检测到登录方式: shop_helper (带货助手登录)');
    return 'shop_helper';
  }

  if (hasSessionId) {
    console.log('[跳转] 检测到登录方式: channels_helper (视频号登录)');
    return 'channels_helper';
  }

  console.log('[跳转] 未检测到有效登录Cookie');
  return null;
}

/**
 * 从Cookie中获取talent_magic
 */
function getTalentMagic() {
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {});

  return cookies.talent_magic || '';
}

/**
 * 从页面数据中获取finderUsername
 *
 * 策略：
 * 1. 尝试从localStorage读取
 * 2. 尝试从全局变量读取
 * 3. 调用API获取
 */
async function getFinderUsername() {
  // 策略1：从localStorage读取（如果之前保存过）
  const cached = localStorage.getItem('finderUsername');
  if (cached) {
    console.log('[跳转] 从localStorage读取finderUsername:', cached);
    return cached;
  }

  // 策略2：调用API获取
  try {
    console.log('[跳转] 调用API获取finderUsername');

    const talentMagic = getTalentMagic();
    if (!talentMagic) {
      console.error('[跳转] 未找到talent_magic Cookie');
      return null;
    }

    const url = 'https://store.weixin.qq.com/shop-faas/mmeckolbasenode/base/getBindChannelList?token=&lang=zh_CN';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'talent_magic': talentMagic
      },
      credentials: 'include'
    });

    const data = await response.json();

    if (data.code === 0) {
      const finderList = data.data?.finderList || data.finderList || [];

      if (finderList.length > 0) {
        const finderUsername = finderList[0].finderUsername;
        console.log('[跳转] API返回finderUsername:', finderUsername);

        // 缓存到localStorage
        localStorage.setItem('finderUsername', finderUsername);

        return finderUsername;
      }
    }

    console.error('[跳转] API返回失败:', data);
    return null;
  } catch (error) {
    console.error('[跳转] 获取finderUsername失败:', error);
    return null;
  }
}

/**
 * 带货助手 → 视频号跳转
 */
async function jumpFromShopToChannels() {
  console.log('[跳转] 开始执行：带货助手 → 视频号');

  // 检查是否应该跳转（防止循环跳转）
  if (!shouldJump()) {
    return;
  }

  try {
    // 记录跳转时间
    recordJumpTime();

    // 延迟2秒，确保页面完全加载
    console.log('[跳转] 等待2秒，确保页面稳定...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 0. 从当前页面URL Hash中获取browser_id和owner，传递到跳转后的页面
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const browserId = params.get('browser_id') || '';
    const owner = params.get('owner') || '';

    // 1. 获取finderUsername
    console.log('[跳转] 获取finderUsername...');
    const finderUsername = await getFinderUsername();

    if (!finderUsername) {
      console.error('[跳转] 无法获取finderUsername，取消跳转');
      return;
    }

    // 2. 获取talent_magic
    const talentMagic = getTalentMagic();
    if (!talentMagic) {
      console.error('[跳转] 未找到talent_magic Cookie，取消跳转');
      return;
    }

    // 3. 调用跳转API
    console.log('[跳转] 调用genSkipFinderPlatformCode API');

    const apiUrl = `https://store.weixin.qq.com/shop-faas/mmeckolbasenode/base/genSkipFinderPlatformCode?token=&lang=zh_CN&toFinderusername=${encodeURIComponent(finderUsername)}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'talent_magic': talentMagic
      },
      credentials: 'include'
    });

    const data = await response.json();

    console.log('[跳转] API响应:', data);

    if (data.ret === 0 && data.code) {
      // 4. 构建跳转URL（直接跳转到视频管理页面，并传递browser_id和owner参数）
      // 使用 Hash 而不是查询参数，避免重定向时丢失
      const targetUrl = `https://channels.weixin.qq.com/platform/post/list?external_token=${encodeURIComponent(data.code)}&external_scene=8&external_type=8#browser_id=${encodeURIComponent(browserId)}&owner=${encodeURIComponent(owner)}`;

      console.log('[跳转] 准备跳转到:', targetUrl);

      // 5. 在新标签页打开
      window.open(targetUrl, '_blank');

      console.log('[跳转] 已在新标签页打开视频号视频管理页面');

      // 6. 移除当前页面的 plugin_mode 参数，防止刷新后重复跳转
      const currentHash = window.location.hash.substring(1);
      const currentParams = new URLSearchParams(currentHash);
      currentParams.delete('plugin_mode');
      const newHash = currentParams.toString();
      if (newHash) {
        window.location.hash = newHash;
      } else {
        // 如果没有其他参数了，清空 hash
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      console.log('[跳转] 已清除plugin_mode参数，防止刷新后重复跳转');
    } else {
      console.error('[跳转] API返回失败:', data);
    }
  } catch (error) {
    console.error('[跳转] 跳转失败:', error);
  }
}

/**
 * 查找"带货中心"按钮（带重试机制）
 */
async function findShopButton(maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    console.log(`[跳转] 尝试查找"带货中心"按钮 (${i + 1}/${maxRetries})`);

    // 方法1：通过文本内容查找
    const links = document.querySelectorAll('a.finder-ui-desktop-menu__link');

    for (const link of links) {
      const text = link.textContent || '';
      if (text.includes('带货中心')) {
        console.log('[跳转] 找到"带货中心"按钮');
        return link;
      }
    }

    // 方法2：通过更精确的选择器
    const selector = 'a.finder-ui-desktop-menu__link.finder-ui-desktop-menu__has_icon';
    const allLinks = document.querySelectorAll(selector);

    for (const link of allLinks) {
      const nameElement = link.querySelector('.finder-ui-desktop-menu__name');
      if (nameElement && nameElement.textContent.includes('带货中心')) {
        console.log('[跳转] 通过备用选择器找到"带货中心"按钮');
        return link;
      }
    }

    // 方法3：查找所有链接，遍历查找
    const allATags = document.querySelectorAll('a[href="javascript:;"]');
    for (const link of allATags) {
      if (link.textContent.includes('带货中心') || link.textContent.includes('带货')) {
        console.log('[跳转] 通过备用方法找到"带货中心"按钮');
        return link;
      }
    }

    // 等待2秒后重试
    if (i < maxRetries - 1) {
      console.log('[跳转] 等待2秒后重试...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return null;
}

/**
 * 视频号 → 带货助手跳转（通过点击"带货中心"按钮）
 */
async function jumpFromChannelsToShop() {
  console.log('[跳转] 开始执行：视频号 → 带货助手');

  // 检查是否应该跳转（防止循环跳转）
  if (!shouldJump()) {
    return;
  }

  try {
    // 记录跳转时间
    recordJumpTime();

    // 查找"带货中心"按钮（最多重试10次，每次间隔2秒）
    console.log('[跳转] 开始查找"带货中心"按钮...');
    const shopLink = await findShopButton(10);

    if (!shopLink) {
      console.error('[跳转] 未找到"带货中心"按钮，取消跳转');
      console.log('[跳转] 提示：可能该账号未开通带货功能，或页面结构已变化');
      return;
    }

    // 模拟点击（触发完整的鼠标事件序列）
    console.log('[跳转] 准备点击"带货中心"按钮');

    // 使用完整的鼠标事件序列（mousedown → mouseup → click）
    const mousedownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0
    });
    shopLink.dispatchEvent(mousedownEvent);

    const mouseupEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0
    });
    shopLink.dispatchEvent(mouseupEvent);

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      detail: 1
    });
    shopLink.dispatchEvent(clickEvent);

    console.log('[跳转] 已模拟点击"带货中心"按钮，带货助手页面将在当前标签页打开');

    // 移除当前页面的 plugin_mode 参数，防止刷新后重复跳转
    const currentHash = window.location.hash.substring(1);
    const currentParams = new URLSearchParams(currentHash);
    currentParams.delete('plugin_mode');
    const newHash = currentParams.toString();
    if (newHash) {
      window.location.hash = newHash;
    } else {
      // 如果没有其他参数了，清空 hash
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    console.log('[跳转] 已清除plugin_mode参数，防止刷新后重复跳转');
  } catch (error) {
    console.error('[跳转] 跳转失败:', error);
  }
}

/**
 * 从URL Hash获取所有参数
 * @returns { pluginMode, browserId, owner }
 */
function getHashParams() {
  const hash = window.location.hash;

  if (!hash) {
    return { pluginMode: null, browserId: null, owner: null };
  }

  // 移除开头的 #
  const hashContent = hash.substring(1);

  // 解析Hash参数（支持 key=value 格式）
  const params = new URLSearchParams(hashContent);

  return {
    pluginMode: params.get('plugin_mode'),
    browserId: params.get('browser_id'),
    owner: params.get('owner')
  };
}

/**
 * 检测当前页面是否是跳转而来（带 external_token）
 */
function isFromJump() {
  const url = new URL(window.location.href);
  return url.searchParams.has('external_token');
}

/**
 * 主执行函数
 */
async function main() {
  // 等待页面加载完成
  if (document.readyState !== 'complete') {
    console.log('[永久链接助手] 等待页面加载完成...');
    await new Promise(resolve => {
      window.addEventListener('load', resolve);
    });
  }

  // 延迟执行，确保页面完全加载、Cookie已设置
  console.log('[跳转] 等待3秒，确保页面完全加载...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 获取页面信息和插件模式参数
  const pageType = detectPageType();
  const { pluginMode, browserId, owner } = getHashParams();
  const fromJump = isFromJump();

  // ✅ 只有带了 plugin_mode 参数才执行跳转逻辑
  if (pluginMode) {
    console.log('[跳转] 检测到插件模式:', pluginMode);
    console.log('[跳转] 当前页面:', pageType);

    // 根据插件模式参数决定跳转方向
    if (pluginMode === 'shop' && pageType === 'shop_page' && AUTO_JUMP_CONFIG.shopToChannels) {
      // 模式=shop + 当前在带货助手 → 跳转到视频号
      console.log('[跳转] 模式=shop，当前在带货助手 → 跳转到视频号');
      await jumpFromShopToChannels();
    } else if (pluginMode === 'channels' && pageType === 'channels_page' && AUTO_JUMP_CONFIG.channelsToShop) {
      // 模式=channels + 当前在视频号 → 跳转到带货助手
      console.log('[跳转] 模式=channels，当前在视频号 → 跳转到带货助手');
      await jumpFromChannelsToShop();
    } else {
      console.log('[跳转] 插件模式与页面不匹配，不执行跳转');
      console.log(`  - 插件模式: ${pluginMode}`);
      console.log(`  - 当前页面: ${pageType}`);
    }
  } else {
    console.log('[永久链接助手] 未检测到插件模式参数，跳过自动跳转逻辑');
  }

  // ========== 其他插件功能：提取跳转后的视频号 Cookie ==========
  // 只在以下情况下执行：
  // 1. 当前在视频号页面
  // 2. URL带 external_token 参数（说明是从带货助手跳转来的）
  // 3. Hash中带有 browser_id 和 owner 参数
  if (pageType === 'channels_page' && fromJump && browserId && owner) {
    console.log('[Cookie提取] 检测到从带货助手跳转而来，准备提取视频号Cookie');
    await extractAndUploadChannelsCookie();
  } else if (pageType === 'channels_page' && !fromJump) {
    console.log('[Cookie提取] 当前是视频号页面，但不是从跳转来的，跳过Cookie提取');
  }

  console.log('[永久链接助手] 插件初始化完成');
}

/**
 * 提取视频号Cookie并上传到云端
 */
async function extractAndUploadChannelsCookie() {
  try {
    // 1. 从URL Hash中获取browserId和owner
    const { browserId, owner } = getHashParams();

    if (!browserId) {
      console.log('[Cookie提取] 未找到browser_id参数，跳过上传');
      return;
    }

    console.log('[Cookie提取] browserId:', browserId);

    // 2. 从Cookie中提取sessionid和wxuin
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {});

    const sessionid = cookies.sessionid;
    const wxuin = cookies.wxuin;

    if (!sessionid || !wxuin) {
      console.log('[Cookie提取] Cookie尚未就绪，等待3秒后重试...');
      // 延迟3秒后重试一次
      setTimeout(() => extractAndUploadChannelsCookie(), 3000);
      return;
    }

    console.log('[Cookie提取] Cookie提取成功，准备上传到数据库');

    // 3. 直接更新 Supabase 数据库
    try {
      const supabaseUrl = 'https://jsfjdcbfftuaynwkmjey.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzZmpkY2JmZnR1YXlud2ttamV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwODI2NDUsImV4cCI6MjA3NTY1ODY0NX0.7SBL2PTnEuCE3sfEHby9jy6N75wjtVxGCtO7zUvN6cg';

      const now = Math.floor(Date.now() / 1000);

      console.log('[Cookie提取] 更新数据库字段');

      const response = await fetch(`${supabaseUrl}/rest/v1/permanent_links?browser_id=eq.${browserId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          shop_to_channels_sessionid: sessionid,
          shop_to_channels_wxuin: wxuin,
          shop_to_channels_updated_at: now
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Cookie提取] 数据库更新失败:', response.status, errorText);
        return;
      }

      console.log('[Cookie提取] 数据库更新成功');
    } catch (error) {
      console.error('[Cookie提取] 数据库更新异常:', error);
    }

  } catch (error) {
    console.error('[Cookie提取] 提取Cookie失败:', error);
  }
}

// 执行主函数
main().catch(error => {
  console.error('[跳转] 主函数执行失败:', error);
});
