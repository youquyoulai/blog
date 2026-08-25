---
title: "轻量笔记Memos的便捷与不足"
date: "2026-04-30T13:48:00+08:00"
lastmod: "2026-07-12T15:57:13+08:00"
slug: "memosbiji"
categories: ["jilu"]
tags: ["blog"]
description: "昨晚在cloudfare部署了Memos，预备记录平时的三言两语。我的想法是导航栏菜单加上Memos链接，侧边栏调用一两条最新微语内容就行。 Memos搭建比较简单，使用了cloudfare的很多服务：后端APICloudflare Wor…"
---

昨晚在cloudfare部署了Memos，预备记录平时的三言两语。我的想法是导航栏菜单加上Memos链接，侧边栏调用一两条最新微语内容就行。

Memos搭建比较简单，使用了cloudfare的很多服务：后端APICloudflare Workers，数据库 Cloudflare D1，文件存储 Cloudflare R2，前端页面 Cloudflare Pages。对于我这样的hugo+cloudfare博客来说，有种浑然一体的感觉。

实际使用起来，我发现Memos发布内容真的很方便。后台登录进去后，写文字、上传图片、添加链接、加标签?、保存，就行了。比用typecho、wordpress要省事得多。

![Memos的使用](https://img.pgoj.top/2026slt/memos.png)

但是我也发现了Memos的不足：

（1）文章列表页面太干净了，干净到没有点赞按钮或评论功能，就是纯纯的发布的图文。

（2）我的侧边栏在移动端是隐藏的，微语怎么也调用不出来，一直显示加载中，电脑上能正调用。

（3）数据库在Cloudflare D1，致使有些时候Memos页面打开非常慢。

演示页：[Memos演示](https://memos.pgoj.top )

将评论系统由waline换成了twikoo，主要原因是最新版的waline不支持嵌套评论，回复和原评论只能平级显示。

2026年5月2日

一直正常使用的Twikoo，不知怎么，昨晚修改文件后修改文件后不显示评论内容了，回退到修改之前也不行。没办法，只好再次拾起waline。因为最新版本的没有评论嵌套功能，所以用的是低版本的，中间也是问题不断。折腾来折腾去，足足一整天，才算可用。
