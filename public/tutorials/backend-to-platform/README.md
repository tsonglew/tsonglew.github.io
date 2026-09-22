# 慢读 · 前三课配套示例

这是《后端程序员的全平台开发课》的第一组可运行代码。只包含 HTML、CSS 和固定 JSON 数据，不需要安装 npm 依赖。

- [阅读课程总目录](https://tsonglew.github.io/blog/backend-to-platform)
- [第 1 课：API 已经写好了，一个可用的前端还缺什么](https://tsonglew.github.io/blog/backend-to-platform-01-browser)
- [第 2 课：从 JSON 到页面](https://tsonglew.github.io/blog/backend-to-platform-02-html)
- [第 3 课：把页面排好](https://tsonglew.github.io/blog/backend-to-platform-03-css)

## 运行

安装 Python 3 后，在解压得到的示例目录中运行。

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8080/` 查看示例目录，或直接打开下面的地址。

- `http://127.0.0.1:8080/02-html/index.html`，只使用 HTML 的页面。
- `http://127.0.0.1:8080/03-css/index.html`，在同一份 HTML 上加入 CSS 的页面。
- `http://127.0.0.1:8080/resources.json`，三条固定资料的原始数据。

终端按 `Ctrl+C` 停止服务器。直接双击 HTML 文件也可以阅读和查看布局，但表单与网络面板练习请使用上面的 HTTP 服务。

## 文件

```text
index.html            示例目录
resources.json        固定数据，items + total
02-html/index.html    语义化 HTML
03-css/index.html     同一份 HTML，仅增加样式表链接
03-css/styles.css     盒模型、布局、响应式与键盘焦点样式
README.md             运行与练习说明
```

两版 HTML 的差异只有 `<link rel="stylesheet" href="./styles.css">`。你可以在终端检查它。

```sh
diff -u 02-html/index.html 03-css/index.html
```

## 数据和交互范围

三条记录是 `resources.json` 的手工投影，直接写在 HTML 中。页面没有 JavaScript，不会发请求读取 JSON，也没有登录、添加收藏或修改阅读状态的功能。

搜索框是一个真实的原生 GET 表单，`action="./index.html"` 指向当前目录中的 HTML 文件。输入关键词并提交后，浏览器把字段 `q` 加到 URL 上，例如 `/03-css/index.html?q=HTML`，再重新请求页面。静态服务器仍然返回同一份 HTML，所以三条资料都会保留。输入框带有 `required`，留空提交时会触发浏览器内置校验。

阅读状态用文字显示，分别为未读、阅读中、已归档。JSON 值分别是 `unread`、`reading`、`archived`。

## 自己动手验收

1. 打开 `02-html/index.html`，不用鼠标，按 `Tab` 找到资料链接、搜索框和提交按钮。
2. 在搜索框输入 `HTML` 并提交，观察地址栏中的 `?q=HTML`。确认列表没有筛选，区分表单提交与搜索功能。
3. 打开 `03-css/index.html`，在浏览器开发者工具中把宽度依次改成 1280、768、390 和 320 像素。桌面是侧栏与资料区两列，窄屏按顺序变为一列，页面不应横向溢出。
4. 把一条资料标题换成长文本，把标签数量增加到五个，确认卡片可以变高和换行。
5. 在开发者工具中禁用 `styles.css`，观察内容、链接、表单和阅读顺序仍然存在。
