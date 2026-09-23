# 慢读 · AI 辅助前端开发实战工具箱

用提示词、架构约束和可复现证据，检查 AI 生成的前端是否真的可用。示例使用原生 HTML、CSS、JavaScript，不需要 npm 依赖，也不会调用 AI 服务。

- [阅读课程总目录](https://tsonglew.github.io/blog/backend-to-platform)
- [打开完整提示词](./prompts.md)，包含需求开发、架构 ADR、证据排错和性能优化。
- [打开实验室](./lab/index.html)，复现搜索竞态，比较同步与分批计算。

## 本地运行

安装 Python 3 后，在解压得到的 `backend-to-platform` 目录中运行。

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8080/` 查看工具箱。其余入口如下。

- `http://127.0.0.1:8080/lab/index.html`，交互实验。
- `http://127.0.0.1:8080/prompts.md`，完整提示词。
- `http://127.0.0.1:8080/02-html/index.html`，语义验收基线。
- `http://127.0.0.1:8080/03-css/index.html`，响应式验收基线。
- `http://127.0.0.1:8080/resources.json`，三条固定资料。

按 `Ctrl+C` 停止服务器。实验室不发网络请求，直接双击 `lab/index.html` 也可离线运行。原生表单与网络面板练习请使用 HTTP 服务。页面链接明确写出 `index.html`，兼容博客开发服务器的路径规则。

## 实验一，搜索请求竞态

1. 选择“故障模式”，点击“一键复现竞态”。
2. 页面先发 #1 HTML，80 ms 后发 #2 React。用本地 `setTimeout` 模拟响应，计划延迟分别为 900 ms、200 ms，没有真实 API。
3. 两次响应结束后，观察当前关键词为 React，结果来源却变成 #1 HTML。时间线显示旧响应如何覆盖新结果。
4. 切换“修复模式”再运行。结果保留 #2 React，时间线显示 #1 被丢弃。
5. 把复现步骤、预期、实际和完整时间线填进 `prompts.md` 的“03 证据排错 prompt”。

修复只在 `requestId === latestRequestId` 时采用结果，不取消旧请求。实际日志时间由 `performance.now()` 测得；计划延迟不保证精确执行。请保持页面在前台，避免同时运行性能实验，以便观察这个隔离场景。

## 实验二，主线程阻塞与分批处理

1. 保持默认“标准 · 800 万项”，点击“运行同步计算”。设备较慢时可先选择“轻量 · 200 万项”。
2. 点击“运行分批计算”，保持相同计算量。两种模式访问相同整数序列，执行相同校验和函数。
3. 查看实测总耗时、最长工作片段、运行期心跳和校验和。两种模式都运行后，页面检查校验和是否一致。
4. 运行期间尝试“点我计数”，观察 80 ms 心跳。同步计算会阻塞主线程；分批每约 8 ms 通过 `setTimeout(resolve, 0)` 让出执行机会。
5. 用 DevTools Performance 录制定位 `computeRange`，把真实证据填进“04 性能优化 prompt”。

总耗时由 `performance.now()` 实测，包含分批等待，不含运行前留给绘制的等待。最长工作片段是计算代码连续执行的区间，单个片段可能超出目标预算。心跳是定时器回调计数，不是帧率。

分批仍在主线程执行，可能增加总耗时。结果依赖设备、后台负载、浏览器调度和预热情况。这些数字不是 INP，也不能代替真实用户的 Core Web Vitals。改变计算量会清除两种模式的结果，避免拿不同输入直接比较。

## 原有页面作为验收基线

`02-html/index.html` 和 `03-css/index.html` 保持原 URL。两版 HTML 的差异只有 `<link rel="stylesheet" href="./styles.css">`，用于检查 AI 修改后是否丢失语义、阅读顺序与原生行为。

```sh
diff -u 02-html/index.html 03-css/index.html
```

这两个页面没有 JavaScript。三条资料手工写在 HTML 中，对应 `resources.json`，不会自动请求或加载 JSON，也没有登录、添加收藏或修改阅读状态的功能。

原搜索框是 GET 表单，`action="./index.html"` 指向当前目录中的 HTML 文件。提交后 URL 例如 `/03-css/index.html?q=HTML`，静态服务仍返回同一份 HTML，**不会筛选资料**。`required` 在空输入时触发浏览器内置校验。未读、阅读中、已归档对应 JSON 中的 `unread`、`reading`、`archived`。

可交给 AI 执行的基线检查如下。

- 用 `Tab` 访问链接、搜索框和按钮，确认焦点可见、顺序合理。
- 在 1280、768、390、320 px 检查布局，窄屏单列、页面不横向溢出。
- 加长标题、增加标签，确认内容可以换行。
- 禁用 CSS，确认标题、链接、表单和阅读顺序仍然成立。
- 核对代码与声明的能力，不把占位页面误认为搜索功能已经完成。

## 文件与复核

```text
index.html            AI 实战工具箱入口
prompts.md            四套完整提示词
resources.json        固定数据，items + total
lab/index.html        竞态与主线程实验界面
lab/lab.js            实验逻辑与校验和计算
lab/styles.css        实验室样式
02-html/index.html    语义验收基线
03-css/index.html     响应式验收基线
03-css/styles.css     基线样式及工具箱共享样式
README.md             运行与验收说明
```

在博客仓库中执行 `npm run tutorial:package` 重新生成 `source.zip`。脚本固定文件顺序、时间戳和权限，相同源文件会得到相同压缩包。修改应落在源文件中，然后重新打包。
