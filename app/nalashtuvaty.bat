@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Skipper CRM - nalashtuvannya
node nalashtuvaty.mjs
echo.
pause
