---
description: "昨晚在cloudfare部署了Memos，预备记录平时的三言两语。我的想法是导航栏菜单加上Memos链接，侧边栏调用一两条最新微语内容就行。"
title: "轻量笔记Memos的便捷与不足"
draft: false
date: "2026-04-30T13:48:20+08:00"
slug: "memosbiji"
categories:
 - jilu
tags:
 - 博客
image: ""
images:
 - https://img.pgoj.top/memos.png
---

昨晚在cloudfare部署了Memos，预备记录平时的三言两语。我的想法是导航栏菜单加上Memos链接，侧边栏调用一两条最新微语内容就行。

Memos搭建比较简单，使用了cloudfare的很多服务：后端APICloudflare Workers，数据库 Cloudflare D1，文件存储 Cloudflare R2，前端页面 Cloudflare Pages。对于我这样的hugo+cloudfare博客来说，有种浑然一体的感觉。

实际使用起来，我发现Memos发布内容真的很方便。后台登录进去后，写文字、上传图片、添加链接、加标签🏷、保存，就行了。比用typecho、wordpress要省事得多。

![Memos的使用](https://img.pgoj.top/memos.png)

但是我也发现了Memos的不足：

（1）文章列表页面太干净了，干净到没有点赞按钮或评论功能，就是纯纯的发布的图文。

（2）我的侧边栏在移动端是隐藏的，微语怎么也调用不出来，一直显示加载中，电脑上能正调用。

（3）数据库在Cloudflare D1，致使有些时候Memos页面打开非常慢。

演示页：[Memos演示](https://memos.pgoj.top )
