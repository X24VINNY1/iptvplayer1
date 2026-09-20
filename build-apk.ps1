# OnyxStream Local APK Build Script (PowerShell)
# Prerequisites: JDK 17+ and Android SDK (or Android Studio)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Building OnyxStream Android TV APK " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Step 1: Web build
Write-Host "[1/4] Building production web assets..." -ForegroundColor Yellow
npm run build

# Step 2: Capacitor Sync
Write-Host "[2/4] Syncing assets to native Android project..." -ForegroundColor Yellow
npx cap sync android

# Step 3: Gradle APK Assemble
Write-Host "[3/4] Compiling APK using Gradle Wrapper..." -ForegroundColor Yellow
Set-Location -Path "android"

if ($IsWindows -or $env:OS -match "Windows") {
    .\gradlew.bat assembleDebug
} else {
    chmod +x ./gradlew
    ./gradlew assembleDebug
}

Set-Location -Path ".."

# Step 4: Copy APK to root
$apkSource = "android\app\build\outputs\apk\debug\app-debug.apk"
$apkDest = "OnyxStream.apk"

if (Test-Path $apkSource) {
    Copy-Item -Path $apkSource -Destination $apkDest -Force
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host " SUCCESS! APK Generated: $apkDest" -ForegroundColor Green
    Write-Host " You can now host or transfer this file to your TV." -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
} else {
    Write-Host "Build completed, check android/app/build/outputs/apk/ for outputs." -ForegroundColor Yellow
}
