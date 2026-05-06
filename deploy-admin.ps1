#Requires -Version 5.1
<#
.SYNOPSIS
    博客管理后台一键部署脚本
.DESCRIPTION
    1. 构建 Hugo 博客
    2. 部署 Cloudflare Worker API
    3. 部署博客到 Cloudflare Pages（含 admin 目录）
#>
param(
    [switch]$SkipBuild,
    [switch]$WorkerOnly
)

$ErrorActionPreference = "Continue"
$Start = Get-Date

function Write-Step($msg) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

# Check dependencies
Write-Host ""
Write-Host "检查依赖..." -ForegroundColor Yellow

if (-not (Test-Command "hugo")) {
    $hugo = Join-Path $PSScriptRoot "hugo.exe"
    if (Test-Path $hugo) { $env:PATH += ";$PSScriptRoot" } else {
        Write-Host "Hugo not found" -ForegroundColor Red
        exit 1
    }
}

# Step 1: Build Hugo
if (-not $WorkerOnly) {
    Write-Step "Step 1/3: Building Hugo"
    Push-Location $PSScriptRoot
    try {
        $result = cmd /c "hugo --config hugo.toml 2>&1" | Out-String
        if ($LASTEXITCODE -ne 0) { Write-Host $result -ForegroundColor Red; exit 1 }
        Write-Host "Hugo build complete" -ForegroundColor Green
    } finally { Pop-Location }
}

# Step 2: Deploy Worker
Write-Step "Step 2/3: Deploying Cloudflare Worker API"
Push-Location $PSScriptRoot
try {
    $result = cmd /c "npx wrangler deploy admin/worker.js --config admin/wrangler-admin.toml 2>&1" | Out-String
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Worker deployed!" -ForegroundColor Green
    } else {
        Write-Host $result -ForegroundColor Yellow
    }
} finally { Pop-Location }

# Step 3: Deploy Pages
if (-not $WorkerOnly) {
    Write-Step "Step 3/3: Deploying to Cloudflare Pages"
    Push-Location $PSScriptRoot
    try {
        $result = cmd /c "npx wrangler pages deploy public --project-name=blog --branch=main 2>&1" | Out-String
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Pages deployed!" -ForegroundColor Green
        } else {
            Write-Host $result -ForegroundColor Yellow
        }
    } finally { Pop-Location }
}

$cost = (Get-Date) - $Start
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Done! (took $($cost.TotalSeconds.ToString('0.0'))s)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URLs:" -ForegroundColor White
Write-Host "  Blog:  https://www.pgoj.top" -ForegroundColor Cyan
Write-Host "  Admin: https://www.pgoj.top/admin/" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: Set secrets before first use:" -ForegroundColor Yellow
Write-Host "  npx wrangler secret put ADMIN_TOKEN --config admin/wrangler-admin.toml" -ForegroundColor Gray
Write-Host "  npx wrangler secret put GITHUB_TOKEN --config admin/wrangler-admin.toml" -ForegroundColor Gray
Write-Host ""
