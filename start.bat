@echo off
title Master Technology Online Billing System
echo ========================================================
echo   Starting Master Technology Online Billing System...
echo ========================================================
echo.
echo Starting web server on http://localhost:3000
start "" "http://localhost:3000"
node server.js
pause
