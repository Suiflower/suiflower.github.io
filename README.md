# Sora's Garden

[打开博客](https://suiflower.github.io/) · [查看发布进度](https://github.com/Suiflower/suiflower.github.io/actions)

数学思考、读书笔记和日常随笔。源码存放在这个仓库，网页由 GitHub Pages 托管；每次向 `main` 提交修改后，GitHub Actions 会自动生成并发布。

## 写一篇新手记

1. 打开 `content/posts/`，新建一个 `.md` 文件，或复制现有文章。
2. 修改开头的信息，再写正文。
3. 提交到 `main`，等待 Actions 中的发布任务变成绿色。

```text
---
title: 文章标题
date: 2026-10-26
category: 数学思考
tags: 实分析, 思维方法
description: 一两句话介绍这篇文章。
slug: a-unique-english-slug
demo: false
---

在这里写正文。
```

分类使用「数学思考」「读书笔记」「日常随笔」之一。`slug` 是文章地址，使用唯一的小写英文、数字和短横线。之后更改它会改变文章链接。

行内公式用 `$a_n\to L$`。独立公式在上下单独两行写 `$$`，例如：

```text
$$
L = \sup\{a_n : n\in\mathbb N\}.
$$
```

公式在发布前用 KaTeX 生成，阅读时无需访问第三方公式服务。公式写错时发布会停止，可在 Actions 中查看原因。

## 修改博客介绍

- `content/about.md`：关于页。
- `site.json`：站名、昵称、简介和正式网址。
- `public/assets/style.css`：配色和排版。
- `public/assets/notebook.svg`：首页的原创数学插图。

目前三篇文章都是明确标注的排版示例。正式写作时可以删除示例 `.md` 文件，并将 `site.json` 中的 `showDemoNotice` 改为 `false`，移除首页示例提示和禁止搜索引擎索引的标记。单篇真实文章的 `demo` 设为 `false`。

## 发布设置

仓库的 **Settings → Pages → Build and deployment → Source** 应选择 **GitHub Actions**。发布流程位于 `.github/workflows/pages.yml`，生成的 `dist/` 会作为网页发布，不需要手动上传生成文件，也不需要购买服务器。

GitHub Pages 只接收生成后的静态网页。源码中的文章、模板和构建脚本也保存在公开仓库，便于版本管理。

## 本地查看

需要 Node.js 24 或兼容的较新版本。首次安装依赖，修改后重新生成：

```powershell
npm ci --ignore-scripts
npm run build
npm run dev
```

打开终端显示的本地网址。`npm run dev` 只提供静态预览，不会自动重新构建；修改后重新执行 `npm run build` 并刷新网页。

## 目录

| 位置 | 内容 |
| --- | --- |
| `content/posts/` | Markdown 文章 |
| `content/about.md` | 关于页 |
| `site.json` | 博客基本设置 |
| `public/assets/` | 原创图形、配色和交互 |
| `scripts/build.mjs` | 生成文章、目录、RSS 和站点地图 |
| `.github/workflows/pages.yml` | 自动发布配置 |
| `dist/` | 本地生成的静态网站，不提交到仓库 |

图形为本项目原创 SVG；没有使用参考博客的文章、头像或插画。KaTeX 与 Markdown-it 按各自开源许可证使用；生成网站中包含 KaTeX 的许可证。
