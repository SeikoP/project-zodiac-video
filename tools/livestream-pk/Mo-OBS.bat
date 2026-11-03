@echo off
chcp 65001 >nul
rem Mo OBS (ban portable da cai san) voi profile Zodiac Live
set "OBS=%LOCALAPPDATA%\Programs\obs-studio\bin\64bit"
if not exist "%OBS%\obs64.exe" (echo Khong thay OBS tai %OBS% & pause & exit /b 1)
cd /d "%OBS%"
start "" obs64.exe --profile "Zodiac Live" --collection "Zodiac Live"
