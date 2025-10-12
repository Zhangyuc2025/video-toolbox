import type { App } from 'vue';

export function setupI18n(app: App) {
  // 简化版：不再使用 i18n
  // 仅保留函数以兼容现有代码
}

// 中文翻译映射表
const zhCNMap: Record<string, string> = {
  // 通用
  'common.confirm': '确定',
  'common.cancel': '取消',
  'common.close': '关闭',
  'common.switch': '切换',
  'common.search': '搜索',
  'common.keywordSearch': '请输入关键词搜索',
  'common.noData': '暂无数据',
  'common.tip': '提示',
  'common.logout': '退出登录',
  'common.logoutConfirm': '确认退出登录吗？',
  'common.check': '勾选',
  'common.expandColumn': '展开列',
  'common.deleteSuccess': '删除成功',
  'common.add': '新增',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.update': '更新',
  'common.refresh': '刷新',
  'common.reset': '重置',
  'common.export': '导出',
  'common.import': '导入',
  'common.save': '保存',
  'common.back': '返回',
  'common.action': '操作',
  'common.status': '状态',
  'common.enable': '启用',
  'common.disable': '禁用',
  'common.description': '描述',
  'common.remark': '备注',
  'common.createTime': '创建时间',
  'common.updateTime': '更新时间',

  // 系统
  'system.title': '视频号工具箱',

  // 图标
  'icon.themeConfig': '主题配置',
  'icon.fullscreen': '全屏',
  'icon.fullscreenExit': '退出全屏',
  'icon.reload': '刷新页面',
  'icon.collapse': '折叠菜单',
  'icon.expand': '展开菜单',
  'icon.pin': '固定',
  'icon.unpin': '取消固定',

  // 登录页面
  'page.login.common.loginOrRegister': '登录 / 注册',
  'page.login.common.userNamePlaceholder': '请输入用户名',
  'page.login.common.phonePlaceholder': '请输入手机号',
  'page.login.common.codePlaceholder': '请输入验证码',
  'page.login.common.passwordPlaceholder': '请输入密码',
  'page.login.common.confirmPasswordPlaceholder': '请再次输入密码',
  'page.login.common.validateSuccess': '验证成功',
  'page.login.common.loginSuccess': '登录成功',
  'page.login.common.welcomeBack': '欢迎回来，{userName} ！',
  'page.login.common.back': '返回',

  // 密码登录
  'page.login.pwdLogin.title': '密码登录',
  'page.login.pwdLogin.rememberMe': '记住我',
  'page.login.pwdLogin.forgetPassword': '忘记密码？',
  'page.login.pwdLogin.register': '注册账号',
  'page.login.pwdLogin.otherAccountLogin': '其他登录方式',
  'page.login.pwdLogin.superAdmin': '超级管理员',
  'page.login.pwdLogin.admin': '管理员',
  'page.login.pwdLogin.user': '普通用户',

  // 验证码登录
  'page.login.codeLogin.title': '验证码登录',
  'page.login.codeLogin.getCode': '获取验证码',
  'page.login.codeLogin.reGetCode': '{time}秒后重新获取',

  // 注册
  'page.login.register.title': '注册账号',
  'page.login.register.agreement': '我已阅读并同意',
  'page.login.register.protocol': '《用户协议》',
  'page.login.register.policy': '《隐私政策》',

  // 重置密码
  'page.login.resetPwd.title': '重置密码',

  // 绑定微信
  'page.login.bindWeChat.title': '绑定微信',

  // 表单验证
  'form.required': '不能为空',
  'form.userName.required': '请输入用户名',
  'form.userName.invalid': '用户名格式不正确',
  'form.phone.required': '请输入手机号',
  'form.phone.invalid': '手机号格式不正确',
  'form.pwd.required': '请输入密码',
  'form.pwd.invalid': '密码格式不正确，6-18位字符',
  'form.confirmPwd.required': '请再次输入密码',
  'form.confirmPwd.notMatch': '两次输入密码不一致',
  'form.code.required': '请输入验证码',
  'form.code.invalid': '验证码格式不正确',
  'form.email.required': '请输入邮箱',
  'form.email.invalid': '邮箱格式不正确',

  // 主题配置
  'theme.themeDrawerTitle': '主题配置',
  'theme.themeSchema.title': '主题模式',
  'theme.themeSchema.light': '亮色模式',
  'theme.themeSchema.dark': '暗色模式',
  'theme.themeSchema.auto': '跟随系统',
  'theme.grayscale': '灰度模式',
  'theme.colourWeakness': '色弱模式',
  'theme.recommendColor': '使用推荐颜色',
  'theme.recommendColorDesc': '是否使用推荐的主题颜色，推荐使用 UnoCSS 颜色生成器',
  'theme.themeColor.title': '主题颜色',
  'theme.themeColor.primary': '主色',
  'theme.themeColor.info': '信息色',
  'theme.themeColor.success': '成功色',
  'theme.themeColor.warning': '警告色',
  'theme.themeColor.error': '错误色',
  'theme.themeColor.followPrimary': '跟随主色',
  'theme.layoutMode.title': '布局模式',
  'theme.layoutMode.vertical': '左侧菜单模式',
  'theme.layoutMode.horizontal': '顶部菜单模式',
  'theme.layoutMode.vertical-mix': '左侧菜单混合模式',
  'theme.layoutMode.horizontal-mix': '顶部菜单混合模式',
  'theme.layoutMode.reverseHorizontalMix': '顶部菜单混合模式反转',
  'theme.pageFunTitle': '页面功能',
  'theme.resetCacheStrategy.title': '重置缓存策略',
  'theme.resetCacheStrategy.refresh': '刷新页面时重置',
  'theme.resetCacheStrategy.switch': '切换路由时重置',
  'theme.scrollMode.title': '滚动模式',
  'theme.scrollMode.wrapper': '外层滚动',
  'theme.scrollMode.content': '主体滚动',
  'theme.page.animate': '页面切换动画',
  'theme.page.mode.title': '页面切换动画类型',
  'theme.page.mode.fade': '淡入淡出',
  'theme.page.mode.fade-slide': '滑动',
  'theme.page.mode.fade-bottom': '底部消退',
  'theme.page.mode.fade-scale': '缩放消退',
  'theme.page.mode.zoom-fade': '渐变',
  'theme.page.mode.zoom-out': '闪现',
  'theme.fixedHeaderAndTab': '固定头部和标签栏',
  'theme.header.height': '头部高度',
  'theme.header.breadcrumb.visible': '显示面包屑',
  'theme.header.breadcrumb.showIcon': '显示面包屑图标',
  'theme.header.multilingual.visible': '显示多语言',
  'theme.header.globalSearch.visible': '显示全局搜索',
  'theme.tab.visible': '显示标签栏',
  'theme.tab.cache': '缓存标签页',
  'theme.tab.height': '标签栏高度',
  'theme.tab.mode.title': '标签栏风格',
  'theme.tab.mode.chrome': 'Chrome风格',
  'theme.tab.mode.button': '按钮风格',
  'theme.sider.inverted': '深色侧边栏',
  'theme.sider.width': '侧边栏宽度',
  'theme.sider.collapsedWidth': '侧边栏折叠宽度',
  'theme.sider.mixWidth': '混合布局侧边栏宽度',
  'theme.sider.mixCollapsedWidth': '混合布局侧边栏折叠宽度',
  'theme.sider.mixChildMenuWidth': '混合布局子菜单宽度',
  'theme.footer.visible': '显示底部',
  'theme.footer.fixed': '固定底部',
  'theme.footer.height': '底部高度',
  'theme.footer.right': '底部居右',
  'theme.watermark.visible': '显示水印',
  'theme.watermark.text': '水印文本',
  'theme.watermark.enableUserName': '使用用户名作为水印',
  'theme.themeDrawer.title': '主题配置',
  'theme.themeDrawer.copyConfig': '复制配置',
  'theme.themeDrawer.resetConfig': '重置配置',
  'theme.themeDrawer.copySuccess': '复制成功',
  'theme.configOperation.copyConfig': '复制配置',
  'theme.configOperation.copySuccessMsg': '复制成功，请替换 src/theme/settings.ts 中的变量 themeSettings',
  'theme.configOperation.resetConfig': '重置配置',
  'theme.configOperation.resetSuccessMsg': '重置成功',

  // 路由
  'route.home': '首页',
  'route.403': '无权限',
  'route.404': '页面不存在',
  'route.500': '服务器错误',
  'route.accounts': '账号管理',
  'route.data': '数据看板',
  'route.settings': '系统设置',

  // 请求
  'request.logout': '登录状态已过期，请重新登录！',
  'request.logoutMsg': '您的登录状态已过期，请重新登录！',
  'request.logoutWithModal': '提示',
  'request.logoutWithModalMsg': '登录状态已失效，您可以继续留在该页面，或者重新登录',
  'request.tokenExpired': '登录状态已过期！'
};

export function $t(key: string, params?: Record<string, string | number>) {
  // 从映射表中查找翻译
  let translation = zhCNMap[key];

  // 如果找不到翻译，返回 key 的最后一部分
  if (!translation) {
    const parts = key.split('.');
    translation = parts[parts.length - 1];
  }

  // 处理参数替换，例如：{userName}
  if (params) {
    Object.keys(params).forEach(paramKey => {
      translation = translation.replace(`{${paramKey}}`, String(params[paramKey]));
    });
  }

  return translation;
}

export function setLocale(locale: string) {
  // 简化版：仅保留中文，不做任何操作
  console.log('Locale set to:', locale);
}
