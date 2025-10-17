; 自定义 NSIS 安装钩子
; 在安装后将 browser-extension 从 resources 移动到 exe 同目录

!macro customInstall
  ; 打印日志
  DetailPrint "正在安装浏览器插件到应用目录..."

  ; 将浏览器扩展从 resources 目录复制到安装根目录
  ; Tauri会将resources打包到 $INSTDIR\_up_\resources\browser-extension
  ; 我们需要将它复制到 $INSTDIR\browser-extension

  CopyFiles /SILENT "$INSTDIR\_up_\resources\browser-extension\*.*" "$INSTDIR\browser-extension\"

  ; 递归复制所有子目录（如果有的话）
  ; 注意：如果browser-extension有子目录，需要递归复制
  ${If} ${FileExists} "$INSTDIR\_up_\resources\browser-extension\*.*"
    CreateDirectory "$INSTDIR\browser-extension"
    CopyFiles /SILENT "$INSTDIR\_up_\resources\browser-extension\*.*" "$INSTDIR\browser-extension\"
  ${EndIf}

  ; 打印完成日志
  DetailPrint "浏览器插件已安装到 $INSTDIR\browser-extension"
!macroend

!macro customUnInstall
  ; 卸载时删除 browser-extension 文件夹
  DetailPrint "正在删除浏览器插件..."
  RMDir /r "$INSTDIR\browser-extension"
  DetailPrint "浏览器插件已删除"
!macroend
