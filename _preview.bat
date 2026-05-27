@echo off
cd /d "%~dp0"
taskkill /IM hugo.exe /F 2>nul
rmdir /S /Q public 2>nul
hugo server -D --baseURL http://localhost:1313/ --port 1313 --bind 0.0.0.0
