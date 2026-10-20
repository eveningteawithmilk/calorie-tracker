@echo off
title CalTrack - AI Calorie & Nutrition Tracker
echo ========================================================
echo   Starting CalTrack Full-Stack AI Server...
echo   SQLite Database & Gemini Nutrition Engine Initializing
echo ========================================================
echo.
timeout /t 1 >nul
start "" http://localhost:3000
node server/index.js
pause
