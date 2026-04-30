---
url: /archives/bearblog-add-microblog-feature-and-homepage-call.html

title: "bearblog添加微博功能并首页调用"
date: 2026-03-02
lastmod: 2026-03-21
slug: "bearblog-add-microblog-feature-and-homepage-call"
categories: ['guangan']
tags: ["博客"]
---

bearblog实现类似微博的功能还挺简单的，因为bearblog支持调用文章全部内容。具体操作步骤如下：

1、新建微博页面，在属性里添加`class_name: microblog`

2、主题css中添加代码

```
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
```

3、home中添加`<section class="microblog">

{{ posts | tag:微语 | content:True | limit:1 }}

</section>`

4、发布文章时，属性添加`tags: 微语`

5、演示：[bearblog添加微博功能并首页调用][1]

  [1]: https://pgoj.bearblog.dev/
