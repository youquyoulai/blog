# Weisay Grace 主题推送脚本
# 使用方法：双击运行此脚本，或右键选择"使用 PowerShell 运行"

# ========== 配置区域 ==========
# 请将 YOUR_TOKEN 替换为你的 GitHub Personal Access Token
$GITHUB_TOKEN = "YOUR_TOKEN_HERE"

# 仓库地址（通常不需要修改）
$REPO_URL = "https://github.com/youquyoulai/blog.git"

# 提交信息
$COMMIT_MESSAGE = "feat: 添加新的友情链接"
# ==================================

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Weisay Grace 主题推送脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Token 配置
if ($GITHUB_TOKEN -eq "YOUR_TOKEN_HERE") {
    Write-Host "【错误】请先配置 GitHub Token！" -ForegroundColor Red
    Write-Host ""
    Write-Host "Token 获取步骤：" -ForegroundColor Yellow
    Write-Host "1. 登录 GitHub -> Settings -> Developer settings" -ForegroundColor White
    Write-Host "2. Personal access tokens -> Generate new token" -ForegroundColor White
    Write-Host "3. 设置 token 名称，选择 repo 权限" -ForegroundColor White
    Write-Host "4. 生成后复制 token，替换脚本中的 YOUR_TOKEN_HERE" -ForegroundColor White
    Write-Host ""
    Write-Host "请编辑此脚本，在第 7 行设置正确的 Token！" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按回车键退出"
    exit 1
}

# 切换到主题目录
$ThemePath = "e:\blog\themes\weisaygrace"
Set-Location $ThemePath

Write-Host "【1/4】检查 Git 状态..." -ForegroundColor Green
git status --short

Write-Host ""
Write-Host "【2/4】添加文件..." -ForegroundColor Green
git add data/links.yaml

Write-Host ""
Write-Host "【3/4】提交修改..." -ForegroundColor Green
git commit -m $COMMIT_MESSAGE

Write-Host ""
Write-Host "【4/4】推送到远程仓库..." -ForegroundColor Green

# 配置远程仓库（带 Token）
$TOKEN_REPO_URL = "https://${GITHUB_TOKEN}@github.com/youquyoulai/blog.git"
git remote set-url origin $TOKEN_REPO_URL

# 执行推送
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  推送成功！✓" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "访问仓库确认：https://github.com/youquyoulai/blog/commits/main" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "【错误】推送失败，请检查 Token 是否正确！" -ForegroundColor Red
}

Write-Host ""
Read-Host "按回车键退出"
