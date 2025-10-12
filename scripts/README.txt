========================================
Tauri 自动打包发布工具
========================================

使用方法：
---------

1. 双击运行 release.bat

2. 选择版本升级类型：
   - Patch (1.0.0 -> 1.0.1) - 修复bug
   - Minor (1.0.0 -> 1.1.0) - 新功能
   - Major (1.0.0 -> 2.0.0) - 重大更新
   - Custom - 自定义版本号
   - Keep current - 保持当前版本

3. 等待打包完成 (2-5分钟)

4. 打包成功后会提示是否打开输出文件夹

输出文件：
---------
位置: src-tauri\target\release\bundle\nsis\

- 视频号工具箱_版本号_x64-setup.exe (安装包)
- 视频号工具箱_版本号_x64-setup.nsis.zip (更新包)
- 视频号工具箱_版本号_x64-setup.nsis.zip.sig (签名文件)

注意事项：
---------
1. 打包前确保代码已提交
2. 确保签名密钥文件存在: C:\Users\zhang\.tauri\videotoolbox.key
3. 打包时间较长(2-5分钟)，请耐心等待

发布流程：
---------
1. 运行 release.bat 打包
2. 创建 GitHub Release (tag: 版本号，例如 1.0.1)
3. 上传生成的3个文件到 Release:
   - 视频号工具箱_版本号_x64-setup.exe
   - 视频号工具箱_版本号_x64-setup.nsis.zip
   - 视频号工具箱_版本号_x64-setup.nsis.zip.sig
4. 双击 upload-update-interactive.bat
   (或命令行: upload-update.bat 1.0.1)
5. 输入版本号和更新说明
6. 测试自动更新功能

问题排查：
---------
- 如果提示找不到密钥文件，请检查密钥路径
- 如果打包失败，请检查是否安装了所有依赖
- 如果有中文乱码，脚本已使用 UTF-8 BOM 编码

========================================
Made for Tauri + Vue3 Desktop Apps
========================================
