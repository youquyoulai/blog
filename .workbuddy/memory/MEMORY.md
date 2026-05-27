# MEMORY.md - 博客项目长期记忆

## 博客技术栈
- Hugo 静态博客，主题 **weisaygrace**（xlxn 已弃用），源码在 GitHub `youquyoulai/blog`
- Cloudflare Pages 自动构建部署，站点 `https://www.pgoj.top/`
- **Waline** 评论系统，服务端 `https://waline.pgoj.top`（weisaygrace 主题使用）

## URL 和 Permalink
- permalink 规则: `posts = '/archives/:slug.html'`
- Cloudflare Pages 会 308 去掉 .html 后缀（平台内置行为，无法关闭）
- 旧文章 frontmatter 手动写了 `url: /archives/xxx.html`，不能删除（否则无 slug 的文章会生成中文 URL）
- 本地预览用 `hugo server -D --baseURL http://localhost:1313/`（因为有手动 url 字段）

## Waline 评论（weisaygrace 主题）
- path 逻辑兼容带/不带 .html: `pathname.endsWith('.html') ? pathname : pathname + '.html'`
- 评论区使用 lazy load（滚动到评论区才加载）

## 注意事项
- 批量修改文章 frontmatter 时注意编码问题，建议用 Python 脚本而非 PowerShell
- `public/` 目录缓存可能导致构建错误（如 .html 变成目录），需彻底删除后重建
- Cloudflare 重定向规则容易造成无限循环，慎用
- Hugo 模板中不可用 `regexp.QuoteMeta`，需用 `replaceRE` 替代
- **⚠️ Hugo sitemap 勿动 `[outputs]`**：只用 `[sitemap]` 配置块（changefreq/priority/filename），Hugo 内置自动生成。若在 `[outputs]` 中加入 sitemap，会导致全站文章页被渲染成 XML（事故发生于 2026-05-20）

## 主题模板结构说明（weisaygrace）
- `pages/single.html`：pages/ section 的通用页面模板（显示内容 + Waline 评论），不要用作特定功能
- `page/links.html` 和 `pages/links.html`（如有）：文汇专用模板
- `search/single.html`：搜索页专用模板（有 id=searchResults）
- baseof.html 中通过 `{{ if eq .Layout "search" }}` 决定是否加载 search.js
- 各页面 frontmatter 的 `layout:` 字段必须对应 layouts/ 下的同名模板文件

## 主题优化记录（weisaygrace）
- CSS/JS 通过 Hugo pipeline minify + fingerprint
- 分类名映射提取为 `partials/cat-names.html`
- 移动端暗色模式：浮动月亮按钮 `.floating-dark-toggle`（position:fixed，右下角）
- 删除顶栏月亮按钮，改为浮动悬浮样式
- 侧边栏工具栏：暗色模式按钮替换为邮箱按钮 `blog@pgoj.top`
- 友链页 RSS 抓取优化（3 个 URL，4s 超时）
- MutationObserver 只监听 head/body childList
- 添加 robots.txt 模板

## Admin 后台管理（2026-05-27 新增友链 Tab）
- 地址：`https://www.pgoj.top/admin/`，文件位于 `static/admin/`
- Worker API 部署在 `api.pgoj.top`（`static/admin/worker.js`）
- Tab 列表：图库、文章、分类/标签、文汇、**友链**、页面、评论、设置
- 友链数据源：`themes/weisaygrace/data/links.yaml`（YAML 格式，通过 js-yaml 解析/序列化）
- 文汇 RSS 源：`data/wenhui-feeds.json`
- 修改 worker.js 后需重新部署到 Cloudflare Workers 才能生效（通过 Dashboard 或 wrangler）

