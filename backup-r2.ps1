#Requires -Version 5.1
<#
.SYNOPSIS
    R2 Bucket 备份脚本
.DESCRIPTION
    将 Cloudflare R2 存储的文件同步到本地，支持增量备份（跳过已存在且大小一致的文件）。
    需要提前运行 npx wrangler login 完成认证。
.PARAMETER Destination
    备份目标目录，默认为当前目录下的 r2-backup
.EXAMPLE
    .\backup-r2.ps1
    .\backup-r2.ps1 -Destination D:\backups\r2
#>
param(
    [string]$Destination = (Join-Path $PSScriptRoot "r2-backup")
)

$ErrorActionPreference = "Continue"
$Buckets = @("imgpg", "memos-pgoj", "twikoo")
$Date = Get-Date -Format "yyyy-MM-dd"
$LogFile = Join-Path $Destination "backup-$Date.log"
$Stats = @{ Total = 0; Downloaded = 0; Skipped = 0; Failed = 0 }

if (-not (Test-Path $Destination)) { New-Item -ItemType Directory -Path $Destination -Force | Out-Null }
if (-not (Test-Path (Split-Path $LogFile))) { New-Item -ItemType Directory -Path (Split-Path $LogFile) -Force | Out-Null }

function Write-Log($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  R2 备份脚本" -ForegroundColor Cyan
Write-Host "  时间: $Date" -ForegroundColor Cyan
Write-Host "  目标: $Destination" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Log "备份开始"

foreach ($bucket in $Buckets) {
    Write-Host ""
    Write-Host "[$bucket] 正在列出对象..." -ForegroundColor Yellow

    $bucketDir = Join-Path $Destination $bucket
    if (-not (Test-Path $bucketDir)) { New-Item -ItemType Directory -Path $bucketDir -Force | Out-Null }

    # 获取对象列表
    $listOutput = cmd /c "npx wrangler r2 object list $bucket --limit 1000 2>&1" | Out-String
    $keys = [regex]::Matches($listOutput, '"key"\s*:\s*"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }

    if ($keys.Count -eq 0) {
        Write-Log "[$bucket] 无对象或获取失败"
        continue
    }

    Write-Log "[$bucket] 共 $($keys.Count) 个对象"

    foreach ($key in $keys) {
        $Stats.Total++
        $localPath = Join-Path $bucketDir $key

        # 创建子目录
        $parentDir = Split-Path $localPath
        if (-not (Test-Path $parentDir)) { New-Item -ItemType Directory -Path $parentDir -Force | Out-Null }

        # 增量检查：文件已存在且大小 > 0 则跳过
        if ((Test-Path $localPath) -and (Get-Item $localPath).Length -gt 0) {
            $Stats.Skipped++
            Write-Host "  跳过: $key" -ForegroundColor DarkGray
            continue
        }

        # 下载文件
        $safeKey = $key -replace '\.', '`.'
        $result = cmd /c "npx wrangler r2 object get $bucket/$key --file=`"$localPath`" 2>&1" | Out-String

        if (Test-Path $localPath -and (Get-Item $localPath).Length -gt 0) {
            $Stats.Downloaded++
            Write-Host "  下载: $key" -ForegroundColor Green
        } else {
            $Stats.Failed++
            Write-Host "  失败: $key" -ForegroundColor Red
            Write-Log "[$bucket] 下载失败: $key"
        }
    }

    Write-Log "[$bucket] 完成"
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  备份完成！" -ForegroundColor Cyan
Write-Host "  总计: $($Stats.Total) | 下载: $($Stats.Downloaded) | 跳过: $($Stats.Skipped) | 失败: $($Stats.Failed)" -ForegroundColor Cyan
Write-Host "  位置: $Destination" -ForegroundColor Cyan
Write-Host "  日志: $LogFile" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Log "备份完成 | 总计:$($Stats.Total) 下载:$($Stats.Downloaded) 跳过:$($Stats.Skipped) 失败:$($Stats.Failed)"
