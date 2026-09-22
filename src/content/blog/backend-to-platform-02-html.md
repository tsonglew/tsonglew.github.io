---
title: '后端转全平台 02｜从 JSON 到一个能用的页面'
description: '用语义化 HTML 手工搭出个人资料库，理解文档结构、链接、标签和 GET 表单，在引入 JavaScript 前先用好浏览器的原生能力。'
publishDate: 2026-09-23
tags: [后端转全平台, 前端, 教程]
series: backend-to-platform
seriesOrder: 2
---

这节课会得到一页能阅读、能打开资料链接、能用键盘提交查询参数的个人资料库。它还没有过滤功能，页面上的资料由我们手工填写。

你需要完成上一课的本地启动，准备一个文本编辑器。先打开[本课成品](/tutorials/backend-to-platform/02-html/index.html)，也可以[下载源码](/tutorials/backend-to-platform/source.zip)。本课用到的表单提交与校验规则已对照 MDN 文档，练习直接使用浏览器提供的行为。

## 先决定每个字段放在哪里

打开源码中的 `resources.json`。每条记录包含标题、地址、简介、标签和阅读状态。我们先把第一条记录摆到页面上，确认结构能用，再补齐另两条。

| 数据字段         | 页面中的位置                         |
| ---------------- | ------------------------------------ |
| `title` 与 `url` | 资料标题与标题上的链接               |
| `description`    | 标题下的一段简介                     |
| `tags`           | 便于浏览的主题文字                   |
| `status`         | 显示为「未读」「阅读中」或「已归档」 |
| `id`             | 保留在数据里，下面的最小练习暂时不用 |

字段不必逐个显示给用户。`id` 用于识别记录，显示一串内部标识对本课的阅读任务没有帮助。`unread` 则需要翻译成读者能理解的状态文字。

**先用 HTML 把一条记录表达清楚。** 到动态渲染时，我们会让程序重复同样的结构。现在每个标签都是自己写的，更容易看出一条资料究竟由哪些内容组成。

## 保存一个完整页面

在示例目录中新建 `practice` 文件夹，将下面的代码保存为 `practice/index.html`。与上一课一样，从示例目录运行服务器，然后访问 `http://127.0.0.1:8080/practice/index.html`。这份代码保留最小结构，下载的成品还包含导航和数据说明区。

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>个人资料库</title>
  </head>
  <body>
    <header>
      <h1>个人资料库</h1>
      <p>收藏有用的文章，留时间慢慢读。</p>
    </header>

    <main>
      <section aria-labelledby="search-heading">
        <h2 id="search-heading">查找资料</h2>
        <form action="./index.html" method="get">
          <label for="q">搜索词</label>
          <input id="q" name="q" type="search" required />
          <button type="submit">提交查询参数</button>
        </form>
        <p>本节只提交 URL 参数，暂时不筛选下面的资料。</p>
      </section>

      <section aria-labelledby="library-heading">
        <h2 id="library-heading">我的收藏</h2>
        <ul>
          <li>
            <article>
              <h3>
                <a href="https://developer.mozilla.org/zh-CN/docs/Learn_web_development">
                  MDN Web 入门
                </a>
              </h3>
              <p>从浏览器、HTML 和 CSS 开始，建立 Web 开发的基础知识。</p>
              <p>HTML</p>
              <p>未读</p>
            </article>
          </li>
        </ul>
      </section>
    </main>
  </body>
</html>
```

浏览器会显示黑色文字、带下划线的链接和普通输入框。这已经是一份可以阅读的文档。CSS 会在下一课改变它的排布与外观。

先看 `<head>`。`charset` 指定字符编码，文件也要以 UTF-8 保存。`title` 出现在浏览器标签页中，与页面里可见的 `h1` 各有用途。`lang` 声明文档主要语言，有助于屏幕阅读器等工具选择正确的处理方式。`viewport` 让移动浏览器按照设备宽度设置视口，后面写响应式布局会用到它。[MDN HTML 基础](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Basic_HTML_syntax)

## 用结构说明内容的关系

页面只有一个主要内容区 `main`，收藏放在独立的 `section` 中。`h1` 是整页标题，`h2` 划分查找与收藏区域，`h3` 是每篇资料的标题。我们按内容层级选标题，字号留给 CSS 决定。

`ul` 表达一组没有固定先后顺序的资料，直接子元素使用 `li`。每条资料放进 `article`，因为它有自己的标题和简介，单独取出也能读懂。`aria-labelledby` 引用同一页面上的标题 `id`，让相应区域有可识别的名称。后面增加区域时，记得使用不同的 `id`。

选这些元素有实际用途。浏览器和辅助技术能识别标题、列表与区域，读者可以按结构导航。用一串 `div` 也能显示文字，但这些关系需要另外补充。[MDN 页面结构](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Structuring_documents)

按第一条资料的写法，继续在 `ul` 中补两个 `li`。第二条使用 `用 React 思考` 和 `https://react.dev/learn/thinking-in-react`，状态写成「阅读中」。第三条使用 `TypeScript 手册` 和 `https://www.typescriptlang.org/docs/handbook/intro.html`，状态写成「已归档」。简介与标签可以对照 JSON 填入。

保存、刷新，再去 Elements 中检查。你应该能找到同一个 `ul` 下的三个 `li`，每个条目里都有独立的标题和链接。磁盘里的 JSON 没有自动参与这一步，复制内容是我们手工完成的。

接着打开完整的 `02-html/index.html`，对照自己的练习读一遍。成品增加了页头导航、放阅读清单的 `aside` 和数据说明区，也为元素加了 `class`。`class` 是 CSS 可以复用的选择标记，例如三条资料都能使用 `resource-card`；`id` 则需要在一页内保持唯一。**下一课从完整的 `02-html` 版本继续**，它已经带好布局所需的区域和类名，`practice` 留作本课的手写练习。

## 去另一个地方用链接，执行操作用按钮

点击资料标题会跳转到文章地址，因此这里使用带 `href` 的 `a`。读者可以右键复制地址，或用浏览器命令在新标签页打开。链接文字写文章名，读者在点击之前就知道会去哪里。

提交表单则使用 `button`，并明确写出 `type="submit"`。以后增加清空条件、展开菜单等操作，通常会使用 `type="button"`，再连接相应行为。表单里的按钮若省略类型，可能意外触发表单提交，提前写清楚能少查一个问题。[MDN 按钮元素](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button)

这份代码没有给所有内容加点击事件，也没有 JavaScript。已有的链接和提交按钮能工作，是因为浏览器认识这些 HTML 元素。

## 看清一次原生表单提交

先让输入框保持为空，点击提交按钮。浏览器会提示填写字段，并阻止这次提交，具体文案随浏览器和系统语言变化。这来自 `required`。

再输入 `React 入门`，按回车。地址栏会出现类似下面的地址。

```text
http://127.0.0.1:8080/practice/index.html?q=React+%E5%85%A5%E9%97%A8
```

`action="./index.html"` 指向当前目录的 `index.html`，`method="get"` 让浏览器将表单数据放入查询字符串。`name="q"` 决定参数名，输入内容作为参数值，空格和中文会编码。**控件的 `id` 用于页面内识别，提交字段名由 `name` 决定。** 在本地文件中暂时删掉 `name`，保存、刷新，再提交一次，URL 就不再包含这个输入框对应的字段。[MDN form 元素](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form)

页面仍显示三条资料。Python 静态服务器收到带查询参数的请求后，还是返回同一份 HTML；现在还没有程序读取 `q` 并筛选列表。HTML 中也没有设置输入框的初始 `value`，本课不保证刷新后保留输入，浏览器的自动恢复行为可能不同。

这里还有两件容易漏掉的事。`label` 的 `for="q"` 对应输入框的 `id="q"`，点击「搜索词」文字就能把焦点移进输入框；对辅助技术来说，它也提供了输入框名称。placeholder 会在输入时消失，不能代替这个标签。[MDN label 元素](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/label)

原生校验用于及时提醒用户，服务端仍须检查收到的数据。用户可以绕过页面直接发请求，`required` 也不会替你判断一个关键词在业务上是否有效。

## 用键盘和长文字检查一遍

把鼠标放到一边，按 `Tab` 移动焦点，使用 `Shift+Tab` 后退。你应该能进入输入框，移到提交按钮，再走到三篇资料的链接。链接获得焦点后，按回车可以打开它。

暂时把第一条资料的标题改成一段更长的中文，简介加到三行以上，再缩小窗口。内容应该沿页面顺序继续排列，下一条资料被自然推到下方。HTML 没有为每张卡片规定固定高度，长内容会增加它需要的空间。先保住完整可读的内容，下一课再给它合适的宽度和间距。

## 常见问题

| 现象               | 检查办法                                                        |
| ------------------ | --------------------------------------------------------------- |
| 打开后显示整段代码 | 检查文件是否误存为 `.txt`，请求响应的媒体类型是否为 `text/html` |
| 点击标签没有聚焦   | 对照 `for` 与 `id`，两者必须相同，页面上的 `id` 应保持唯一      |
| 提交后没有 `q`     | 检查输入框是否有 `name="q"`，是否放在这个表单内部               |
| 提交后列表没有变化 | 当前练习只提交参数，筛选逻辑尚未编写                            |
| 修改文件后页面没变 | 保存文件，检查正在访问的目录，然后刷新                          |

## 本课验收

- 在自己的 `practice/index.html` 中补齐三条资料，标题都能打开正确地址。
- 把浏览器标签页标题改成「我的待读资料」，页面主标题仍保留「个人资料库」。
- 不用鼠标完成一次空值提交和一次有效提交，观察两次结果的差别。
- 点击标签能聚焦输入框，并能解释 `id`、`for` 和 `name` 各自负责什么。
- 提交带中文的关键词，在 URL 中找到 `q`，同时说明为什么资料没有被过滤。
- 加长一条标题和简介，确认其他内容仍能正常阅读，没有被固定高度截断。
