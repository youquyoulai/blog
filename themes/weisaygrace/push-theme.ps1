# Weisay Grace 主题推送脚本
# 使用方法：双击运行此脚本，或右键选择"使用 PowerShell 运行"

# ========== 配置区域 ==========
# 从环境变量读取 GitHub Personal Access Token
$GITHUB_TOKEN = $env:GITHUB_TOKEN

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
if (-not $GITHUB_TOKEN) {
    Write-Host "【错误】未检测到 GitHub Token！" -ForegroundColor Red
    Write-Host ""
    Write-Host "请设置环境变量 GITHUB_TOKEN：" -ForegroundColor Yellow
    Write-Host '  $env:GITHUB_TOKEN = "你的Token"' -ForegroundColor White
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
