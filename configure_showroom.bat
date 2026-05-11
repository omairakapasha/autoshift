@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo    AutoShift: Showroom Configuration Setup
echo ====================================================
echo.
echo This script will link your showroom's database to the application.
echo Please enter the credentials provided in your Supabase Dashboard.
echo.

set /p SB_URL="Enter Supabase URL (e.g., https://xyz.supabase.co): "
set /p SB_KEY="Enter Supabase Anon/Publishable Key: "
echo.
echo [Optional] Messaging ^& AI Configuration
echo Leave blank to skip these features.
echo.
set /p TW_SID="Enter Twilio Account SID: "
set /p TW_TOKEN="Enter Twilio Auth Token: "
set /p TW_FROM="Enter Twilio Phone Number (or WhatsApp ID): "
set /p GM_KEY="Enter Gemini AI API Key: "
set /p SN_DSN="Enter Sentry DSN (for error tracking): "
echo.
set /p SH_NAME="Enter Showroom Name (e.g., City Autos): "
set /p SH_PIN="Enter 4-6 digit System Access PIN (for staff): "
set /p AD_PIN="Enter 4-6 digit Admin PIN (for owner actions): "

if "%SB_URL%"=="" (
    echo [ERROR] Supabase URL cannot be empty.
    pause
    exit /b
)

if "%SB_KEY%"=="" (
    echo [ERROR] Supabase Key cannot be empty.
    pause
    exit /b
)

:: Create the .env file for React/Electron to read
echo REACT_APP_SUPABASE_URL=%SB_URL% > .env
echo REACT_APP_SUPABASE_PUBLISHABLE_KEY=%SB_KEY% >> .env
echo TWILIO_ACCOUNT_SID=%TW_SID% >> .env
echo TWILIO_AUTH_TOKEN=%TW_TOKEN% >> .env
echo TWILIO_FROM_NUMBER=%TW_FROM% >> .env
echo GEMINI_API_KEY=%GM_KEY% >> .env
echo REACT_APP_SENTRY_DSN=%SN_DSN% >> .env
echo REACT_APP_SHOWROOM_NAME=%SH_NAME% >> .env
echo REACT_APP_SHOWROOM_PIN=%SH_PIN% >> .env
echo REACT_APP_ADMIN_PIN=%AD_PIN% >> .env

echo.
echo ====================================================
echo    Maintenance ^& Updates
echo ====================================================
echo.
echo NOTE: Auto-updates are currently set to MANUAL.
echo To check for the latest version, please contact your
echo system administrator or visit your download portal.
echo.
echo Your current version: v1.0.0 (Stable)
echo ====================================================
echo.
echo [PRO TIP] For Cloud AI Features (WhatsApp/Gemini):
echo Ensure you have also added these keys to your 
echo Supabase Dashboard under Functions -> Secrets.
echo.
echo [SUCCESS] Configuration linked successfully.
echo You can now launch AutoShift.
echo ====================================================
echo.
pause
