# 博客管理后台 - 部署指南

> 平哥偶记 (pgoj.top) 博客管理后台部署文档

---

## 一、效果预览

部署完成后，访问 `https://www.pgoj.top/admin/`，你将看到：

```
┌─────────────────────────────────────────────┐
│  平哥偶记 · 管理后台              [≡] [登出] │
├─────────────────────────────────────────────┤
│  ┌───────┐ ┌───────┐ ┌───────┐             │
│  │  📷   │ │  📝   │ │  ⚙️   │             │
│  │ 图库  │ │ 文章  │ │ 设置  │             │
│  └───────┘ └───────┘ └───────┘             │
│                                             │
│  [ 拖拽图片到此处上传，或点击选择 ]          │
│                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │
│  │ img │ │ img │ │ img │ │ img │           │
│  └─────┘ └─────┘ └─────┘ └─────┘           │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │
│  │ img │ │ img │ │ img │ │ img │           │
│  └─────┘ └─────┘ └─────┘ └─────┘           │
└─────────────────────────────────────────────┘
```

---

## 二、准备工作（只需做一次）

### 2.1 申请 GitHub Personal Access Token

1. 打开 GitHub：https://github.com
2. 点击右上角头像 → **Settings**
3. 左侧底部找到 **Developer settings**
4. **Personal access tokens** → **Tokens (classic)** → **Generate new token**
5. 配置：
   - **Note**：`blog-admin`（随便写）
   - **Expiration**：建议 30 天或 90 天
   - **Select scopes**：✅ 勾选 `repo`（完整仓库权限）
6. 点击 **Generate token**
7. **⚠️ 重要：页面会显示一串 Token，立即复制保存！关闭页面后就看不到了**

### 2.2 Cloudflare 登录

```bash
cd e:\blog
npx wrangler login
```

浏览器会自动打开，点击 **Authorize** 授权即可。

---

## 三、设置密钥（关键步骤）

这是最重要的步骤！需要设置两个密钥：

### 3.1 设置 ADMIN_TOKEN（后台登录密码）

```bash
npx wrangler secret put ADMIN_TOKEN --config admin/wrangler-admin.toml
```

运行后：
- 提示 `Enter a secret value:` 时，输入一个随机字符串
- 例如：`blog-admin-2026-abc123`（记下来，后面登录要用）
- 按回车确认

### 3.2 设置 GITHUB_TOKEN（GitHub 操作权限）

```bash
npx wrangler secret put GITHUB_TOKEN --config admin/wrangler-admin.toml
```

运行后：
- 提示 `Enter a secret value:` 时，粘贴刚才申请的 GitHub Token
- 按回车确认

### 3.3 验证密钥是否设置成功

```bash
npx wrangler secret list --config admin/wrangler-admin.toml
```

应该看到两个密钥：
```
ADMIN_TOKEN
GITHUB_TOKEN
```

---

## 四、一键部署

```bash
cd e:\blog
.\deploy-admin.ps1
```

脚本会自动完成：
1. ✅ 构建 Hugo 博客
2. ✅ 部署 Cloudflare Worker API
3. ✅ 部署到 Cloudflare Pages

部署成功会显示：
```
========================================
  Done! (took xx.xs)
========================================

URLs:
  Blog:  https://www.pgoj.top
  Admin: https://www.pgoj.top/admin/
```

---

## 五、登录后台

1. 打开浏览器访问：`https://www.pgoj.top/admin/`
2. 首次会弹出登录框
3. 输入刚才设置的 **ADMIN_TOKEN**
4. 点击 **登录**

登录成功后会自动保存 token，后续无需重复登录。

---

## 六、验证功能

### 6.1 测试图片上传
1. 点击底部 **图库** Tab
2. 拖拽一张图片到上传区域
3. 上传成功后，点击图片查看大图
4. 点击 **复制链接**，确认格式为 `@image:xxx.png`

### 6.2 测试文章发布
1. 点击底部 **文章** Tab
2. 点击右上角 **新建**
3. 填写：
   - 标题：`测试文章`
   - 内容：`这是测试内容`
   - 分类：`guangan`
   - 标签：`测试`
4. 点击 **保存草稿**（不发布，仅保存到 GitHub）
5. 或点击 **发布**（保存 + 触发重新构建）

### 6.3 验证发布成功
1. 打开博客首页：`https://www.pgoj.top`
2. 刷新页面
3. 如果点击了发布，等待 1-2 分钟 Cloudflare 构建完成后刷新

---

## 七、移动端使用

### 7.1 添加到主屏幕
1. 用手机浏览器（Safari/Chrome）打开后台
2. **iOS Safari**：点击分享按钮 → **添加到主屏幕**
3. **Android Chrome**：点击菜单 → **安装应用** / **添加到主屏幕**
4. 之后像普通 App 一样点击图标打开

### 7.2 界面说明
- **底部 Tab 栏**：图库 / 文章 / 设置 切换
- **左上角 ≡**：打开侧边栏（设置、关于）
- **触摸手势**：
  - 图片列表：点击查看大图
  - 长按图片：进入多选模式
  - 文章列表：左右滑动快速操作

---

## 八、配置 Worker API 地址

如果你希望 Worker 使用自定义域名（而不是 `*.workers.dev`），需要：

### 8.1 获取 Worker URL
```bash
npx wrangler deployments list --config admin/wrangler-admin.toml
```
找到 `.workers.dev` 链接，格式类似：
`https://blog-admin-api.<你的账号>.workers.dev`

### 8.2 修改前端配置
打开 `admin/index.html`，找到配置区域：

```javascript
const CONFIG = {
    // 重要：修改为你的 Worker URL
    // 如果使用默认的 workers.dev，删除以下行
    // 如果绑定了自定义域名，填写你的自定义域名
    API_BASE: 'https://blog-admin-api.abcdefghijkl.workers.dev',

    // 你的 GitHub 仓库
    GITHUB_REPO: 'youquyoulai/blog',

    // 博客名称
    BLOG_NAME: '平哥偶记',

    // 图片 CDN 基础 URL（用于预览）
    IMAGE_CDN: 'https://img.pgoj.top',
};
```

### 8.3 自定义域名绑定（可选）

如果你有自定义域名，可以给 Worker 绑定：

1. Cloudflare Dashboard → **Workers & Pages** → 找到 `blog-admin-api`
2. **Settings** → **Triggers** → **Custom Domains**
3. 点击 **Add Custom Domain**
4. 输入域名，例如：`api.pgoj.top`
5. 完成后修改前端 `CONFIG.API_BASE` 为 `https://api.pgoj.top`

---

## 九、故障排查

### 9.1 部署失败
```bash
# 查看详细错误
npx wrangler deploy admin/worker.js --config admin/wrangler-admin.toml --verbose
```

常见错误：
- `Not logged in`：运行 `npx wrangler login`
- `R2 bucket not found`：检查 `wrangler-admin.toml` 中桶名是否正确

### 9.2 登录失败
1. 检查 ADMIN_TOKEN 是否正确设置
2. 清除浏览器缓存后重试
3. 打开浏览器开发者工具（F12）→ Console 查看错误

### 9.3 图片上传失败
1. 检查 GitHub Token 是否有 `repo` 权限
2. 检查 R2 桶名是否为 `imgpg`
3. 查看 Worker 日志：`npx wrangler tail --config admin/wrangler-admin.toml`

### 9.4 文章保存失败
常见 GitHub API 错误：
- `401 Unauthorized`：GitHub Token 无效或过期
- `404 Not Found`：仓库路径不对，检查 `worker.js` 中 `REPO` 变量
- `Maximum usage exceeded`：GitHub API 配额用尽（免费版每小时 60 次）

### 9.5 清除登录状态
如果在其他设备登录，或想重新输入 Token：
- 浏览器控制台执行：`localStorage.clear()`
- 或清除浏览器站点数据

---

## 十、日常使用流程

### 发布一篇新文章

```
1. 打开管理后台 (https://www.pgoj.top/admin/)
2. 点击 [图库] → 上传文章所需图片
3. 点击 [文章] → 点击 [新建]
4. 填写前置 matter（标题、日期、分类、标签）
5. 写文章内容，需要插图时：
   - 方法A：点击工具栏 [📷 图库] → 选择图片 → 自动插入 @image:xxx
   - 方法B：手动输入 @image:xxx
6. 点击 [发布]
7. 等待 1-2 分钟，刷新博客查看效果
```

### 重新编辑旧文章

```
1. 点击 [文章] → 找到目标文章
2. 点击文章右侧 [✏️] 编辑按钮
3. 修改内容
4. 点击 [更新]
```

### 删除文章

```
1. 点击 [文章] → 找到目标文章
2. 点击文章右侧 [🗑️] 删除按钮
3. 确认删除
4. 点击 [发布] 同步删除
```

---

## 十一、安全建议

1. **定期更换 Token**：建议每 30-90 天更换一次 GitHub Token
2. **不要分享 Token**：不要在任何聊天工具中分享 ADMIN_TOKEN
3. **单独 GitHub Token**：建议为博客单独申请 Token，不要用日常账号的 Token
4. **启用 2FA**：GitHub 账号建议开启双因素认证

---

## 十二、文件说明

```
e:\blog\admin\
├── index.html              ← 管理后台前端（HTML + CSS + JS 合一）
├── worker.js               ← Cloudflare Worker 后端
├── wrangler-admin.toml     ← Worker 配置
├── manifest.json           ← PWA 配置
└── README.md               ← 本文档

e:\blog\
├── deploy-admin.ps1        ← 一键部署脚本
├── hugo.toml               ← Hugo 配置
└── content\posts\          ← 文章存放目录
```

---

有问题欢迎反馈！📧 wuliwuju@126.com
