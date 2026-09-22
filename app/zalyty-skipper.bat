@echo off
cd /d "%~dp0"
echo.
echo ==========================================
echo   SKIPPER CRM - deploy to Vercel
echo ==========================================
echo.
echo Takes 1-3 minutes. Please wait.
echo.
rem Always link to the skipper-crm project first. Without this, a copied
rem folder is deployed as a NEW project named after the folder.
call npx --yes vercel@latest link --yes --project skipper-crm
call npx --yes vercel@latest deploy --prod --yes
echo.
echo Done. Open: https://skipper-crm.vercel.app
echo.
pause
