# 平哥集录博客 — 项目备忘

## 基本信息
- 仓库: https://github.com/youquyoulai/blog.git (origin/main)
- 线上: https://www.pgoj.top | 后台: https://www.pgoj.top/admin/
- Hugo 主题: weisaygrace (本地维护，非 submodule)

## 内容结构
- 多 section 架构，非 posts 平铺
- mainSections = [math, literature, philosophy, misc, science, history, notes]
- 各 section 有独立 archetypes + _index.md
- data/kb-categories.yaml 定义首页分类卡片（notes 不在卡片内，首页单独展示"近日随记"）
- 2026-07 新增 notes(随记) 模块：时间线列表 + 单页 + Waline 评论

## 部署架构
- Cloudflare Pages 托管静态站（public/ 目录）
- Cloudflare Worker 托管后台 API (static/admin/worker.js, name=blog-admin-api)
- 部署脚本: deploy-admin.ps1 (3步: hugo build → wrangler deploy worker → wrangler pages deploy public)
- Worker 配置: static/admin/wrangler-admin.toml
- Worker 支持 triggerDeploy (CF_DEPLOY_HOOK 触发 Pages 重建)
- R2 桶: imgpg (图片), memos-pgoj, twikoo; 备份脚本 backup-r2.ps1
- 评论: Waline (serverURL: https://waline.pgoj.top)

## 工具路径
- Hugo: /e/Hugo/bin/hugo (或项目根 hugo.exe)
- Wrangler: npx wrangler (v4.98.0)
- Node 管理版: C:\Users\youqu\.workbuddy\binaries\node\versions\22.22.2\node.exe

## 注意事项
- GitHub 直连不稳定，推送可能需要代理
- .gitignore 已忽略 public/ public_new/ hugo-blog-optimization/ resources/ node_modules/
- 后台 admin 通过 GitHub API 读写 content 文件，triggerDeploy 触发 Pages 重建
