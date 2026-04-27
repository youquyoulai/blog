# MEMORY.md - 博客项目长期记忆

## 博客技术栈
- Hugo 静态博客，主题 xlxn，源码在 GitHub `youquyoulai/blog`
- Cloudflare Pages 自动构建部署，站点 `https://www.pgoj.top/`
- Waline 评论系统，服务端 `https://waline.pgoj.top`
- PocketHugo 应用发布文章，格式 `content/posts/日期-slug.md`

## URL 和 Permalink
- permalink 规则: `posts = '/archives/:slug.html'`
- Cloudflare Pages 会 308 去掉 .html 后缀（平台内置行为，无法关闭）
- 旧文章 frontmatter 手动写了 `url: /archives/xxx.html`，不能删除（否则无 slug 的文章会生成中文 URL）
- 本地预览用 `hugo server -D --baseURL http://localhost:1313/`（因为有手动 url 字段）

## Waline 评论
- path 逻辑兼容带/不带 .html: `pathname.endsWith('.html') ? pathname : pathname + '.html'`
- 评论区使用 lazy load（滚动到评论区才加载）

## 注意事项
- 批量修改文章 frontmatter 时注意编码问题，建议用 Python 脚本而非 PowerShell
- `public/` 目录缓存可能导致构建错误（如 .html 变成目录），需彻底删除后重建
- Cloudflare 重定向规则容易造成无限循环，慎用

## 主题优化记录（2026-04-28）
- CSS/JS 通过 Hugo pipeline minify + fingerprint
- 分类名映射提取为 `partials/cat-names.html`
- 删除重复的 `taxonomy/term.html`，保留 `categories/term.html`
- 友链页 RSS 抓取优化（3 个 URL，4s 超时）
- MutationObserver 只监听 head/body childList
- 清理未使用的自定义评论表单样式（Waline 自带）
- 添加 robots.txt 模板
