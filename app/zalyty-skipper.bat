@echo off
cd /d "%~dp0"
echo.
echo ==========================================
echo   SKIPPER CRM - deploy to Vercel
echo ==========================================
echo.
echo Takes 1-3 minutes. Please wait.
echo.
call npx --yes vercel@latest deploy --prod --yes
echo.
echo Done. Open: https://skipper-crm.vercel.app
echo.
pause
