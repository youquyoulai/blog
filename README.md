# Hugo 博客

由 Hugo + weisaygrace 主题生成的静态博客，部署在 Cloudflare Pages。

## 本地开发

```bash
# 本地预览
hugo server

# 构建静态文件
hugo --minify
```

## 部署

推送到 GitHub 后，Cloudflare Pages 自动构建部署。

- 构建命令：`hugo --minify`
- 输出目录：`public`
- Hugo 版本：`0.160.1`
