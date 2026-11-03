@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Dem Hoi Hoang Dao - Live
where node >nul 2>nul || (echo Chua cai Node.js 20 tro len: https://nodejs.org & pause & exit /b 1)
if not exist node_modules (echo Dang cai thu vien lan dau... & call npm install)
call npm run live
pause
