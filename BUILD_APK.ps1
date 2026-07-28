# ============================================================
# Cricket Legacy — One-click APK Builder
# Run this on a machine that has Android Studio installed.
# ============================================================

Write-Host "=== Cricket Legacy APK Builder ===" -ForegroundColor Cyan

# 1. Install dependencies
Write-Host "`n[1/4] Installing npm packages..." -ForegroundColor Yellow
npm install

# 2. Generate build provenance metadata
Write-Host "`n[2/5] Generating build information..." -ForegroundColor Yellow
npm run generate-build-info

# 3. Generate native Android project
Write-Host "`n[3/5] Generating Android project (expo prebuild)..." -ForegroundColor Yellow
npx expo prebuild --platform android --clean

# 4. Build release APK with Gradle
Write-Host "`n[4/5] Building release APK..." -ForegroundColor Yellow
Set-Location android
.\gradlew.bat assembleRelease

# 5. Show result
Set-Location ..
$apkPath = "android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkPath) {
    $infoRaw = Get-Content "src\config\buildInfo.generated.ts" -Raw
    $version = (Get-Content "app.json" -Raw | ConvertFrom-Json).expo.version
    $buildCode = (Get-Content "app.json" -Raw | ConvertFrom-Json).expo.android.versionCode
    $commit = if ($infoRaw -match '"gitCommit": "([^"]+)"') { $Matches[1] } else { "unknown" }
    $uniqueApkPath = "android\app\build\outputs\apk\release\cover-drive-v$version-build$buildCode-$commit.apk"
    Copy-Item -LiteralPath $apkPath -Destination $uniqueApkPath -Force
    $size = (Get-Item $apkPath).Length / 1MB
    Write-Host "`n[5/5] SUCCESS! APK built." -ForegroundColor Green
    Write-Host "File: $apkPath" -ForegroundColor Green
    Write-Host "Traceable copy: $uniqueApkPath" -ForegroundColor Green
    Write-Host "Size: $([math]::Round($size, 1)) MB" -ForegroundColor Green
    Write-Host "`nInstall on your phone with:" -ForegroundColor Cyan
    Write-Host "  adb install $uniqueApkPath" -ForegroundColor White
} else {
    Write-Host "`n[5/5] Build failed. Check the error above." -ForegroundColor Red
}
