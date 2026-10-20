@echo off
title Build CalTrack APK
echo ========================================================
echo   Building CalTrack Android APK...
echo ========================================================
echo.
echo [1/3] Preparing mobile web bundle...
call node scripts/prepare-mobile.js
echo.
echo [2/3] Syncing Capacitor Android assets...
call npx cap sync android
echo.
echo [3/3] Compiling APK with Gradle...
cd android
call gradlew.bat assembleDebug
cd ..
echo.
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    echo ========================================================
    echo SUCCESS! Your APK is ready at:
    echo D:\calorie-tracker\android\app\build\outputs\apk\debug\app-debug.apk
    echo ========================================================
) else (
    echo ========================================================
    echo If Android SDK was not detected, simply open the 
    echo 'D:\calorie-tracker\android' project in Android Studio
    echo and click Build ^> Build APK.
    echo ========================================================
)
pause
