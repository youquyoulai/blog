---
title: "hugo博客利用PocketHugo进行网页发布"
description: "上午继续折腾静态博客：由于我用的是简化版的 Waline，只能发表或者回复评论。于是设计了一个评论管理后台，用来查看最新评论以及进行管理。随后优化了主题文件，涉及性能、SEO等很多地方。静态博客总得在电脑上操作，实在不便。我更习惯躺在床上或随时随地地管理和发布，于是开始寻找解决方案。了解下来，大概有三种方式：其一，在手机上安装 Termux。据说装好后就能用 Git、Hugo，克隆博客仓库，但这东西看着就头疼，直接放弃了。其二，使用手机端的应用，比如 MGit、Git Monster、Obsidian、Collected Notes。可惜这些工具只能在安卓或苹果手机上使用，我的鸿蒙系统装不了。其三，搭建一个网页版发布后台。具体做法是利用 Cloudflare 的免费服务 Workers 设计一个专门的发布后台，发布时使用在线编辑器 PocketHugo。显然，这个方法既靠谱又合我心意。于是再次交给 AI，不到一个小时就搞定了。试了一下，体验真的很棒。要是早知道有 PocketHugo，我早就转向静态博客了。"
date: 2026-04-26T08:54:23+08:00
categories: ['guangan']
tags: ['博客']
thumb: https://img.pgoj.top/pokethugo.png
url: /archives/publish-hugo-blog-using-pockethugo.html
draft: false
---

上午继续折腾静态博客：

由于我用的是简化版的 Waline，只能发表或者回复评论。于是设计了一个评论管理后台，用来查看最新评论以及进行管理。

随后优化了主题文件，涉及性能、SEO等很多地方。

静态博客总得在电脑上操作，实在不便。我更习惯躺在床上或随时随地地管理和发布，于是开始寻找解决方案。了解下来，大概有三种方式：

其一，在手机上安装 Termux。据说装好后就能用 Git、Hugo，克隆博客仓库，但这东西看着就头疼，直接放弃了。

其二，使用手机端的应用，比如 MGit、Git Monster、Obsidian、Collected Notes。可惜这些工具只能在安卓或苹果手机上使用，我的鸿蒙系统装不了。

其三，搭建一个网页版发布后台。具体做法是利用 Cloudflare 的免费服务 Workers 设计一个专门的发布后台，发布时使用在线编辑器 PocketHugo。显然，这个方法既靠谱又合我心意。于是再次交给 AI，不到一个小时就搞定了。试了一下，体验真的很棒。要是早知道有 PocketHugo，我早就转向静态博客了。

![pockethugo](https://img.pgoj.top/pokethugo.png)
