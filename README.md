# Tsonglew's Blog

个人技术博客,基于 [Astro 6](https://astro.build) + [astro-theme-pure](https://github.com/cworld1/astro-theme-pure) 构建,部署于 GitHub Pages。

## 开发

需要 Node.js 22.12+（或兼容的更新版本）、Python 3，以及 Python 的 `fonttools` 和 `brotli`。推荐使用虚拟环境安装字体工具，开发或构建时保持环境激活：

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install fonttools brotli
npm ci
npm run dev        # http://localhost:4321
npm run build      # 生产构建,输出 dist/
npm run preview    # 预览构建产物
```

## 文章

在 `src/content/blog/` 下新建 Markdown 文件即可,frontmatter 参考:

```yaml
---
title: 文章标题
description: 文章描述
publishDate: 2026-08-04
tags: [tech]
draft: false
---
```

## 部署

推送到 `master` 分支后,`.github/workflows/deploy.yaml` 自动构建并发布到 GitHub Pages。

## 旅行笔记

入口为 `/trips/`。页面位于 `public/trips/<名称>/index.html`，以独立 HTML 发布。
新增攻略时更新 `public/trips/index.html` 的列表；构建会自动将旅行目录下的 `index.html` 页面加入站点地图。

## 构建检查

`npm run check` 校验 Astro 和 TypeScript。`npm run build` 会依次生成字体子集、检查主题配置、执行 Astro 检查并构建到 `dist/`。
字体子集生成于 `src/assets/fonts/`，不需要提交。文章插图建议放在 `src/assets/blog/` 并使用相对路径引用，网页和 RSS 均会生成可访问的图片地址。
