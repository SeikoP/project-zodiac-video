@echo off
chcp 65001 >nul
cd /d "%~dp0"
set /p U=Nhap username TikTok (khong can @): 
call npm run setup -- %U%
pause
