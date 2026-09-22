---
title: '后端转全平台 01｜API 写好了，页面还缺什么'
description: '从一份 JSON 和一个资料库页面出发，用浏览器开发者工具追踪请求、DOM 与样式，建立后端开发者需要的前端调试方法。'
publishDate: 2026-09-23
tags: [后端转全平台, 前端, 教程]
series: backend-to-platform
seriesOrder: 1
---

这节课做完，你能在浏览器里找到一个页面的 HTTP 响应，指认标题对应的 DOM 节点，临时改掉它的文字和颜色，并解释刷新后为什么恢复。

你需要会读 JSON、知道 HTTP 请求和响应，电脑上有浏览器与代码编辑器。本地运行示例还需要 Python 3。浏览器操作以 Chrome 为例，其他浏览器也有对应的开发者工具。

先打开[资料库成品预览](/tutorials/backend-to-platform/03-css/index.html)，再看[原始数据](/tutorials/backend-to-platform/resources.json)。想跟着改文件，可以[下载本阶段源码](/tutorials/backend-to-platform/source.zip)。本课对照了 MDN 的 Web 基础文档和 Chrome DevTools 官方教程，下面每个观察都可以在这份示例里重复。

## 先把熟悉的接口放在旁边

我们的项目是一个个人资料库。第一批资料只有三条，分别是 MDN Web 入门、用 React 思考和 TypeScript 手册。数据文件的一部分长这样。

```json
{
  "items": [
    {
      "id": "mdn-web",
      "title": "MDN Web 入门",
      "url": "https://developer.mozilla.org/zh-CN/docs/Learn_web_development",
      "description": "从浏览器、HTML 和 CSS 开始，建立 Web 开发的基础知识。",
      "tags": ["HTML"],
      "status": "unread"
    }
  ],
  "total": 3
}
```

这里为便于阅读只摘出第一条，下载文件里有完整的三条记录。`total` 指整个示例的数据条数。

从后端看，这些字段已经能描述一份收藏。到页面上，还要决定标题能否点击，简介放在哪里，`unread` 显示成什么文字，以及三条资料怎样排列。

成品预览已经替这些问题作了选择。资料标题是链接，状态显示为中文，搜索框有标签，窄窗口里内容会重新排列。**数据提供了内容，页面还要把内容组织成可阅读、可操作的界面。**

目前这两个文件各自独立。HTML 中的三条资料是手工写进去的，页面没有请求 `resources.json`。改 JSON 再刷新，页面不会跟着变。我们会在 JavaScript 章节连接这两部分，眼下先把它们看清楚。

## 让文件经过一次 HTTP 请求

解压源码，进入能看到 `resources.json`、`02-html` 和 `03-css` 的目录。在这个目录打开终端，运行下面的命令。

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

终端保持运行，在浏览器访问下面两个地址。

```text
http://127.0.0.1:8080/resources.json
http://127.0.0.1:8080/03-css/index.html
```

第一个地址能看到数据，第二个能看到资料库。我们在地址中写出 `index.html`，直接请求这份 HTML 文件。

这里绑定 `127.0.0.1`，只有本机能访问。请从示例目录启动，服务器会把这个目录中的文件作为可访问资源。结束练习时，在终端按 `Ctrl+C`。Python 的内置服务器适合这次本地练习，线上部署会在后面的课程处理。[Python 静态服务器说明](https://docs.python.org/3/library/http.server.html)

直接双击 HTML 也能打开这两份静态页面，不过地址会变成 `file://`。本课要观察 HTTP 头和状态码，因此统一用本地服务器。

## 看看浏览器到底收到了什么

在资料库页面右键，选择「检查」，切到 Network 面板。打开面板以后刷新一次。Network 通常从打开后才开始记录请求，先前加载完成的页面可能留下一个空列表。

找到类型为 `document`、名称为 `index.html` 的主文档请求，点进去，依次看三个位置。

| 位置     | 这次要找的内容                                        |
| -------- | ----------------------------------------------------- |
| Headers  | 请求 URL、请求方法、状态码，以及响应的 `Content-Type` |
| Response | 服务器发来的 HTML 文本，可以搜索 `MDN Web 入门`       |
| Timing   | 请求各阶段花了多久，先认识这个入口即可                |

再看列表中的 `styles.css`。它是浏览器读到 HTML 里的样式表链接后发出的另一个请求。一个页面可以依次加载多份资源，主文档返回成功时，其他资源仍可能在传输。[Chrome Network 教程](https://developer.chrome.com/docs/devtools/network)

保持工具打开，访问 JSON 地址，再看这个请求的响应头。正常情况下，JSON 文件的媒体类型是 `application/json`，HTML 文件的是 `text/html`，CSS 文件的是 `text/css`。`Content-Type` 告诉浏览器响应体采用什么媒体类型；HTTP 状态码说明这次请求的处理结果。[MDN Content-Type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Type)

JSON 页面可能带有浏览器提供的折叠或格式化视图。那是查看数据的工具，收藏列表、搜索框等业务界面仍需要我们编写。

## 从响应文本找到眼前的标题

回到资料库页面，右键点击「MDN Web 入门」，选择「检查」。Elements 面板会选中对应的 `<a>` 元素，展开它的父节点，可以找到标题、列表项和整个列表。

浏览器解析 HTML 后，会在内存中建立 DOM，也就是 Document Object Model。程序和开发者工具都可以操作这棵节点树。Elements 展示当前 DOM，Network 的 Response 展示那次请求收到的文本，两者承担不同的工作。

试着做一次小改动。

1. 在 Elements 中双击链接内部的「MDN Web 入门」。
2. 把它改成「今天先学 HTML」，按回车。
3. 看页面，标题已经变化；再看 Network 中原来的 Response，响应文本仍然保持原样。
4. 刷新页面，标题恢复。

这次改动只发生在当前页面的 DOM 中，没有写回磁盘，也没有请求后端保存。刷新后浏览器重新建立页面，临时修改就消失了。浏览器的「查看网页源代码」主要用于看 HTML 来源；排查当前页面状态时，优先看 Elements。[Chrome DOM 教程](https://developer.chrome.com/docs/devtools/dom)

后续加入 JavaScript，脚本也能创建和删除 DOM 节点。那时响应文本里没有某条资料，Elements 中却能找到它，就有了很具体的解释。

## 再追一次颜色从哪里来

继续选中这个链接，在 Elements 旁边找到 Styles。点击 `element.style` 的空白处，加入下面一行。

```css
color: crimson;
```

链接会变红。取消这条声明前的勾选，原来的颜色回来。切到 Computed，可以查看最终计算出的 `color`，以及宽高等结果。Styles 适合查有哪些规则参与，Computed 适合确认最后采用了什么值。

如果选到了外层标题，却没有改动链接颜色，重新检查是否选中了 `<a>`。样式可能直接写在子元素上，改父元素未必覆盖它。第三课会专门处理这些关系。

HTML 描述内容和结构，CSS 参与布局与外观，JavaScript 可以响应操作并改变页面。这次示例还没有 JavaScript，你已经能打开链接、输入文字、提交原生表单。浏览器本身提供了许多基础行为。[MDN Web 工作原理](https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/How_the_web_works)

## 200 之后还要检查什么

现在把窗口拖窄，再用 `Tab` 移动焦点，看看能否进入搜索框和资料链接。这些检查无法由状态码代替。

在以后的动态列表里，一次完整的体验还包括请求尚未结束时的提示，返回空数组时的说明，以及失败后保留输入、允许重试的办法。即使接口最后返回了 200，前面等待的两秒仍然要有人设计。用户操作完成后是否看到了正确结果，也要单独验证。

本阶段的搜索框只演示原生表单提交，输入词语后 URL 会出现查询参数，列表仍然保持三条。下一课会拆开这个行为，读完后你应该能说清它已经做了什么，还缺哪段程序。

## 卡住时先查哪里

| 现象                    | 先做的检查                                          |
| ----------------------- | --------------------------------------------------- |
| 终端找不到 `python3`    | 安装 Python 3，或先使用文首的在线预览完成浏览器练习 |
| 8080 端口已占用         | 将命令中的端口改为 8081，浏览器地址也相应修改       |
| 页面 404 或显示别的文件 | 检查终端所在目录，确认其中直接包含 `03-css`         |
| Network 没有记录        | 保持面板打开再刷新，并清除已有的类型筛选            |
| 页面修改刷新后消失      | 这是临时编辑的预期结果，持久修改需要保存源文件      |

## 本课验收

- 找到 HTML 和 CSS 两个请求，分别记下状态码与媒体类型。
- 不借助网页源代码，直接在 Elements 中定位第二条资料的标题。
- 临时把一个链接改成红色，再撤销这条样式，让页面恢复。
- 指出 `resources.json` 当前是否由页面加载，并用 Network 请求列表支持你的判断。
- 用自己的话解释，接口返回 200 后，为什么还需要检查窄屏阅读和键盘操作。
