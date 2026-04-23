---
title: "第二篇文章"
date: 2026-04-23
draft: false
tags: ["测试"]
summary: "Cloudflare Pages 部署测试"
---

## 部署流程

本博客部署在 Cloudflare Pages 上，流程如下：

1. 在 GitHub 创建仓库，推送代码
2. 在 Cloudflare Pages 中连接 GitHub 仓库
3. 设置构建命令：`hugo --minify`
4. 设置输出目录：`public`
5. 每次推送代码自动触发部署

就这么简单！🚀
