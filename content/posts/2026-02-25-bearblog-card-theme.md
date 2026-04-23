---
url: /archives/bearblog-card-theme.html

title: "bearblog卡片式主题"
date: 2026-02-25
lastmod: 2026-03-21
slug: "bearblog-card-theme"
categories: ['散言']
tags: ["博客"]
---

说明：以下提供的css是官方主题Bento修改而得，主要是调整了一些显示样式，将原来的双排显示改为单行，去掉了网站标题和导航上的数字标记，增加了网页字体随屏幕大小自适应，并增加了微博功能。



代码如下：

```

/* ========== 根变量 ========== */

:root {

    /* 颜色 */

    --color-dark: #231f29;

    --color-light: #f4f4f4;

    --color-light-2: #fff;

    --color-primary: #d10630;

    --color-border: #e0e0e0;

    /* 字体大小：使用 clamp 实现响应式 */

    --size-step-0: clamp(1rem, calc(0.96rem + 0.22vw), 1.13rem); /* 基础字号 */

    --size-step-1: clamp(1.25rem, calc(1.16rem + 0.43vw), 1.5rem);

    --size-step-2: clamp(1.56rem, calc(1.41rem + 0.76vw), 2rem);

    --size-step-3: clamp(1.95rem, calc(1.71rem + 1.24vw), 2.66rem); /* h1/h2 使用 */

    --size-step-4: clamp(2.44rem, calc(2.05rem + 1.93vw), 3.55rem);

    /* 间距、圆角、阴影、字体栈 */

    --spacing: clamp(1rem, 2vw, 2rem);

    --radius: 1rem;

    --shadow: 0 2px 2px rgba(0, 0, 0, 0.04);

    --font-stack: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";

    /* 代码块颜色 */

    --code-background-color: var(--color-dark);

    --code-color: var(--color-light);

}

/* ========== 暗色模式（跟随系统） ========== */

@media (prefers-color-scheme: dark) {

    :root {

        --color-dark: #f4f4f4;

        --color-light: #231f29;

        --color-light-2: #1e1a23;

        --color-primary: #d10630;

        --color-border: #25212c;

    }

}

/* ========== 全局基础样式 ========== */

body {

    background: var(--color-light);

    color: var(--color-dark);

    font-family: var(--font-stack);

    font-size: var(--size-step-0);

    line-height: 1.7;

    display: flex;

    flex-direction: column;

    justify-content: center;

    gap: var(--spacing);

    flex-wrap: wrap;

    min-height: 100vh;

    margin: 0;

    padding: var(--spacing);

}

* {

    box-sizing: border-box;

}

/* ========== 头部 ========== */

header {

    display: flex;

    flex-direction: column;

    gap: calc(var(--spacing) / 4);

    padding-right: 0;

    position: sticky;

    top: 0;

    max-height: 100vh;

    /* 修改：移除半透明渐变，使用纯色背景，并提高层叠顺序 */

    background-image: none;

    background-color: var(--color-light);

    z-index: 10;

    box-shadow: 0 2px 4px rgba(0,0,0,0.05); /* 增加轻微阴影，强化与内容的视觉分隔 */

}

/* ========== 主体内容 ========== */

main {

    flex: 1;

    /* 新增：为main设置背景色和相对定位，确保内容在header下方正确遮挡 */

    background-color: var(--color-light);

    position: relative;

    z-index: 1;

}

/* 主内容区域内的块级元素（除某些特定元素外）添加边框和背景 */

main > *:not(script, form),

main .upvote-button {

    display: block;

    border: 1px solid var(--color-border);

    border-radius: var(--radius);

    padding: var(--spacing);

    background-color: var(--color-light-2);

    box-shadow: var(--shadow);

}

main .upvote-button {

    display: flex;

}

main > *:first-child {

    margin-top: 0;

}

/* 如果主内容包含博客文章列表，移除边框背景 */

content:has(.blog-posts) {

    border: none;

    padding: 0;

    background-color: transparent;

    box-shadow: none;

}

/* ========== 图片 ========== */

img {

    display: block;

    max-width: 100%;

    height: auto;

    border-radius: var(--radius);

    box-shadow: var(--shadow);

}

/* ========== 标题 ========== */

h1, h2, h3, h4, h5 {

    font-weight: 400;

    line-height: 1.3;

    text-wrap: balance;

}

h1 { font-size: var(--size-step-3); }

h2 { font-size: var(--size-step-3); }

h3 { font-size: var(--size-step-2); }

h4 { font-size: var(--size-step-1); }

h5 { font-size: var(--size-step-0); }

/* ========== 列表 ========== */

ul, ol {

    -webkit-padding-start: var(--spacing);

    padding-inline-start: var(--spacing);

}

li {

    --flow-space: var(--spacing);

    margin-block-start: var(--flow-space, var(--spacing));

}

/* ========== 引用块 ========== */

blockquote {

    -webkit-padding-start: var(--spacing);

    padding-inline-start: var(--spacing);

    -webkit-border-start: 0.3em solid;

    border-inline-start: 0.3em solid;

    font-style: italic;

    font-size: var(--size-step-1);

    max-width: 50ch;

}

/* ========== 链接 ========== */

a {

    color: var(--color-primary);

    text-decoration: none;

    font-weight: 400;

}

a:hover {

    text-decoration: underline;

    text-decoration-color: var(--color-border);

}

/* ========== 内容区域内的间距管理 ========== */

content > div > * {

    -webkit-margin-before: var(--flow-space, var(--spacing));

    margin-block-start: var(--flow-space, var(--spacing));

}

content > *:first-child {

    -webkit-margin-before: 0;

    margin-block-start: 0;

}

:is(h1, h2, h3, h4, h5, blockquote) {

    --flow-space: calc(var(--spacing) * 2);

    margin-block-end: calc(var(--spacing) / 2);

}

:is(h1, h2, h3, h4, h5) + * {

    --flow-space: calc(var(--spacing) / 3);

}

:is(h1, h2, h3, h4, h5) + :where(h2, h3, h4, h5) {

    --flow-space: calc(var(--spacing) * 2);

}

/* 标题最大宽度限制 */

h1 { max-width: 24ch; }

h2, h3 { max-width: 32ch; }

/* ========== 特殊类 .title（网站标题区域） ========== */

.title {

    padding: var(--spacing);

    display: flex;

    flex-direction: column;

    word-break: break-word;

    border-radius: var(--radius);

    border-top-left-radius: 0;

    text-decoration: none;

    color: var(--color-light-2);

    background-color: var(--color-primary);

    box-shadow: var(--shadow);

    font-weight: 400;

    max-width: 340px;

}

.title::before {

    content: "";

    font-size: 60%;

}

.title h1 {

    font-size: var(--size-step-2);

    margin: 0;

}

.title:hover {

    text-decoration: none;

}

/* ========== 导航 ========== */

nav p {

    margin: 0;

    display: flex;

    flex-wrap: wrap;

    gap: calc(var(--spacing) / 6);

    counter-reset: nav-counter;

    overflow-x: auto;

    -webkit-overflow-scrolling: touch;

}

nav p a {

    display: flex;

    word-break: break-all;

    text-decoration: none;

    border: 1px solid var(--color-border);

    border-radius: var(--radius);

    gap: calc(var(--spacing) / 8);

    padding: 0.35rem 0.7rem;

    background-color: var(--color-light-2);

    color: var(--color-dark);

    font-weight: 600;

    box-shadow: var(--shadow);

    transition: color 0.2s ease-in-out;

    white-space: nowrap;

    flex-shrink: 0;

}

nav p a::before {

    counter-increment: nav-counter;

    content: "";

    font-size: 60%;

    font-weight: 400;

    color: var(--color-primary);

}

nav p a:hover {

    text-decoration: none;

    color: var(--color-primary);

}

/* ========== 代码高亮 ========== */

.highlight,

.code {

    padding: 1px var(--spacing);

    background-color: var(--code-background-color);

    color: var(--code-color);

    border-radius: var(--radius);

    overflow-x: auto;

    line-height: 1.3;

    box-shadow: var(--shadow);

}

/* ========== 表格 ========== */

table {

    width: 100%;

}

th {

    text-align: left;

}

/* ========== 页脚 ========== */

footer {

    padding: calc(var(--spacing) / 1.1) 0 !important;

    font-size: 60%;

    font-weight: 400;

    font-style: normal;

    color: var(--color-primary);

    text-transform: uppercase;

}

/* ========== 博客文章列表 ========== */

.blog-posts {

    list-style: none;

    margin: 0;

    padding: 0;

    display: flex;

    flex-wrap: wrap;

    gap: calc(var(--spacing) / 4);

}

.blog-posts li {

    display: flex;

    flex-direction: row;

    align-items: center;

    gap: calc(var(--spacing) / 2);

    word-break: break-word;

    text-decoration: none;

    border: 1px solid var(--color-border);

    border-radius: var(--radius);

    padding: calc(var(--spacing) / 1.5) var(--spacing);

    background-color: var(--color-light-2);

    color: var(--color-dark);

    font-weight: 400;

    box-shadow: var(--shadow);

    margin: 0;

    width: 100%;

}

.blog-posts li time {

    font-size: 100%;

    font-weight: 400;

    font-style: normal;

    color: var(--color-primary);

    white-space: nowrap;

    flex-shrink: 0;

    padding-top: 0;

    line-height: 1.5;

}

.blog-posts li a {

    text-decoration: none;

    color: var(--color-dark);

    line-height: 1.5;

    transition: color 0.2s ease-in-out;

    font-size: var(--size-step-0.9);

    flex: 1;

    min-width: 0;

    position: relative;

    z-index: 1;

}

/* 标题遮罩伪元素（半透明主色覆盖） */

.blog-posts li a::before {

    content: '';

    position: absolute;

    top: 0;

    left: 0;

    width: 100%;

    height: 100%;

    background-color: rgba(209, 6, 48, 0.15);

    border-radius: calc(var(--radius) / 2);

    opacity: 0;

    transition: opacity 0.25s ease;

    z-index: -1;

    pointer-events: none;

}

.blog-posts li a:hover {

    color: var(--color-primary);

    text-decoration: none;

}

.blog-posts li a:hover::before {

    opacity: 1;

}

/* ========== 响应式：桌面视图（≥768px） ========== */

@media screen and (min-width: 768px) {

    body {

        flex-direction: row;

        flex-wrap: wrap;

        justify-content: center;

        gap: calc(var(--spacing) / 4);

    }

    header {

        max-width: 25ch;

        top: var(--spacing);

    }

    .title {

        gap: var(--spacing);

    }

    nav p {

        flex-wrap: wrap;

        overflow-x: visible;

        flex-direction: column;

    }

    nav p a {

        width: 100%;

        gap: calc(var(--spacing) / 1.5);

        flex-direction: column;

        padding: calc(var(--spacing) / 1.5) var(--spacing);

        white-space: normal;

    }

    main {

        max-width: 56ch;

        min-width: 38ch;

        transform: translateY(-3px);

    }

    main > article h1,

    main > .post-content h1,

    main > h1:first-of-type {

        font-size: var(--size-step-1);

        max-width: none;

        width: 100%;

    }

    .blog-posts li {

        display: flex;

        flex-direction: row;

        align-items: center;

        gap: var(--spacing);

        padding: var(--spacing);

        width: 100%;

    }

    .blog-posts li time {

        font-size: 100%;

        padding-top: 0;

    }

    .blog-posts li a {

        font-size: var(--size-step-1);

    }

    footer {

        width: 100%;

        margin-top: var(--spacing);

        text-align: center;

        padding: calc(var(--spacing) / 1.1) 0 !important;

        font-size: 60%;

        font-weight: 400;

        font-style: normal;

        color: var(--color-primary);

        text-transform: uppercase;

    }

}

/* ========== 响应式：手机视图（≤767px） ========== */

@media screen and (max-width: 767px) {

    /* 文章页面标题字号调小 */

    main > article h1,

    main > .post-content h1,

    main > h1:first-of-type {

        font-size: var(--size-step-2);

        line-height: 1.2;

        margin-bottom: 0.5em;

    }

    nav p {

        flex-wrap: nowrap;

    }

    /* 手机端文章列表优化：增大点击区域 */

    .blog-posts li {

        padding: 12px var(--spacing);

    }

    .blog-posts li time {

        font-size: 0.9em;

    }

}

/* 只在“微语”页面内，对文章列表应用微博样式 */

.microblog .blog-posts li {

    display: flex;

    flex-direction: column;

}

.microblog .blog-posts > li > a {

    display: none; /* 隐藏标题 */

}

.microblog .blog-posts li small.time {

    order: -1;

    margin-bottom: 0.2em;

    color: var(--color-primary);

}

/* 微语卡片左侧边沿线 + 竖排“微语”标签 */

.microblog .blog-posts li {

    position: relative;

    border-left: none;

    padding-left: calc(var(--spacing) * 2);

}

/* 绘制左侧红色边沿线 */

.microblog .blog-posts li::before {

    content: '';

    position: absolute;

    left: 0;

    top: 3%;

    bottom: 3%;

    width: 1px;

    background-color: var(--color-border);

}

/* 添加竖排的“微语”标签 */

.microblog .blog-posts li::after {

    content: '微语';

    position: absolute;

    left: -6px;

    top: 50%;

    transform: translateY(-50%);

    writing-mode: vertical-rl;

    text-orientation: upright;

    color: var(--color-black);

    font-size: 0.9rem;

    font-weight: bold;

    background-color: var(--color-light-2);

    padding: 4px 2px;

    border-radius: 4px;

    line-height: 1.2;

    letter-spacing: 2px;

    z-index: 2;

    box-shadow: var(--shadow);

}

/* 文章上下篇导航 - 左右布局 */

.post-navigation {

    display: flex;

    justify-content: space-between;

    margin-top: calc(var(--spacing) * 2);

    padding-top: var(--spacing);

    border-top: 1px solid var(--color-border);

    gap: var(--spacing);

}

.post-navigation div {

    flex: 1;

    max-width: 45%;

    word-break: break-word;

}

.post-navigation .nav-next {

    text-align: right;

}

/* 当没有文章时隐藏空容器 */

.post-navigation div:empty {

    display: none;

}

/* 如果某一侧隐藏，另一侧可占满 */

.post-navigation:has(div:empty) div:not(:empty) {

    max-width: 100%;

}

/* 链接样式 */

.post-navigation a {

    display: inline-block;

    padding: calc(var(--spacing) / 2) var(--spacing);

    background-color: var(--color-light-2);

    border: 1px solid var(--color-border);

    border-radius: var(--radius);

    color: var(--color-dark);

    text-decoration: none;

    box-shadow: var(--shadow);

    transition: all 0.2s;

}

.post-navigation a:hover {

    color: var(--color-primary);

    border-color: var(--color-primary);

}

/* 手机响应式 */

@media screen and (max-width: 767px) {

    .post-navigation {

        flex-direction: column;

    }

    .post-navigation div {

        max-width: 100%;

    }

    .nav-next {

        text-align: left;

    }

}

```



演示地址：[bearblog卡片式主题][1]





  [1]: https://pgoj.bearblog.dev/
