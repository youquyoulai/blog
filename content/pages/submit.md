---
title: 提交博客
url: /submit.html
layout: page
description: 提交你的独立博客到比邻，审核通过后展示在聚合列表里。
---

<div class="submit-page">
  <div class="submit-card">
    <div class="submit-info">
      <h3>收录说明</h3>
      <ul>
        <li>比邻收录<b>活跃更新</b>的中文独立博客，优先展示近 180 天有更新的站点。</li>
        <li>请提供博客的 <code>RSS / Atom</code> 地址，我们据此抓取最新文章。</li>
        <li>提交后进入<b>待审核</b>队列，管理员确认无误后即展示。</li>
        <li>不接受纯聚合、采集站与违规内容站点。</li>
      </ul>
    </div>
    <form class="submit-form" id="blog-submit-form" novalidate>
      <div id="submit-msg" class="alert" style="display:none"></div>
      <div class="form-group">
        <label for="f-name">博客名称 <span class="req">*</span></label>
        <input type="text" id="f-name" name="name" placeholder="例如：平哥偶记" maxlength="60">
      </div>
      <div class="form-group">
        <label for="f-site">博客地址</label>
        <input type="text" id="f-site" name="site" placeholder="https://your.blog/ （首页地址，可留空，将用 RSS 域名）" maxlength="200">
      </div>
      <div class="form-group">
        <label for="f-feed">RSS / Atom 地址 <span class="req">*</span></label>
        <input type="text" id="f-feed" name="feed" placeholder="https://your.blog/feed 或 /rss.xml" maxlength="300">
        <span class="hint">不知道 RSS 地址？多数博客为 /feed、/rss.xml 或 /atom.xml。</span>
      </div>
      <div class="form-group">
        <label for="f-desc">博客简介</label>
        <textarea id="f-desc" name="desc" placeholder="一句话介绍你的博客内容（选填）" maxlength="200"></textarea>
      </div>
      <div class="form-group">
        <label for="f-tags">标签</label>
        <input type="text" id="f-tags" name="tags" placeholder="技术, 生活, 摄影（逗号分隔，选填）" maxlength="100">
      </div>
      <input type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-block">提交博客</button>
      </div>
    </form>
  </div>
</div>
