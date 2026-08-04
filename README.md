# Tsonglew's Blog

个人技术博客,基于 [Astro 6](https://astro.build) + [astro-theme-pure](https://github.com/cworld1/astro-theme-pure) 构建,部署于 GitHub Pages。

## 开发

```bash
npm install
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
