# CS2680 中文学习手册

这是个人编写的课程配套学习平台，不是 Harvard 官方网站或课程译本。外部课程要求以 https://cs2680.com/ 为准。

## 内容与构建

- `content/agents.json`、`content/systems.json`：12 章教程、练习、自测与来源。
- `content/resources.json`：已核验资源目录。
- `platform.css`、`platform.js`：阅读体验与本地学习记录。
- `platform-core.js`：交互实验的确定性计算模型。
- `labs/`：Python 离线实验与下载包。
- 页面、章节清单、搜索索引由根目录 `scripts/build-cs2680.py` 生成，HTML 直接提交以沿用 GitHub Pages 构建。

在仓库根目录执行 `python3 scripts/build-cs2680.py`。生成结果是静态 HTML；正文、资源与目录不依赖 JavaScript。自测、笔记、全文搜索和计算器需要 JavaScript。

## 验证

`python3 scripts/check-cs2680.py` 校验页面链接、章节与代码示例。

`node scripts/test-cs2680-core.mjs` 校验算例。

`python3 -m unittest discover -s public/cs2680/labs -p test_labs.py` 校验离线实验。

## 学习数据

`cs2680-platform-v2` 使用浏览器 localStorage，无服务器账户。笔记支持 JSON 备份、恢复和 Markdown 导出。旧导航页的五阶段标记不自动转换为十二章完成记录，以避免误判新教程已读。

所有交互实验为公开公式的简化教学模型，不是硬件性能承诺；不调用收费 API。
