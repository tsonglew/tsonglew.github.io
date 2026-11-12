# Quodex 官网维护

本目录服务 https://tsonglew.github.io/quodex/ ，由本仓库 `master` 分支的 GitHub Pages 工作流部署。

Quodex 用户要求每次开发交付同步官网与 App 仓库 `tsonglew/Quodex` 的 `README.md`。功能、使用步骤、语言、组件尺寸、更新方式和限制必须与最终实现一致。版本与下载入口以实际已发布的 Release 为准，开发中不能写成已发布。

官网只呈现当前产品，不积累版本沿革、历史截图、旧录屏或旧版升级说明。更新时替换过期介绍，并删除不再使用的素材文件，不通过隐藏、折叠或改标签保留历史元素。

界面变动时使用 App 仓库中有来源说明的当前真实截图，保留示例数据标记。网页绘制的交互或组件示意需明确标注，不能冒充原生截图。不要把测试或模拟器覆盖扩展为未经验证的真机支持声明。

当前原生截图 `assets/current/token-trends.png` 与 App 仓库 `docs/screenshots/liquid-selection-alpha41/token-selection.png` 字节一致，来源说明链接在页面图片下方。只在当前版本变化时替换，不增加历史素材目录。

`privacy.txt` 与 App 仓库的 `app/src/main/res/raw-zh/privacy_notice.txt` 保持一致。涉及网络、缓存、桌面展示或数据处理变化时同步原文，并核对发布后的内容。

更新时关联 App 仓库对应的 PR，检查本地资源、链接、手机与桌面布局及相关交互。合并后等待 Pages 部署成功，并打开线上页面核对；最终说明 README 与官网的实际同步状态。
