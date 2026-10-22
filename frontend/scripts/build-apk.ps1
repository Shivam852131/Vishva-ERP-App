[System.Environment]::SetEnvironmentVariable('ANDROID_PREFS_ROOT', '', 'Process')
[System.Environment]::SetEnvironmentVariable('ANDROID_USER_HOME', '', 'Process')
$env:ANDROID_PREFS_ROOT = $null
$env:ANDROID_USER_HOME = $null
Remove-Item Env:\ANDROID_PREFS_ROOT -ErrorAction SilentlyContinue
Remove-Item Env:\ANDROID_USER_HOME -ErrorAction SilentlyContinue

$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "C:\Users\shiva\AppData\Local\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH

$real = "C:\Users\shiva\OneDrive\Desktop\vishva erp app\frontend"

Write-Host "[1/3] Bundling React Native JavaScript..."
Set-Location "$real"
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

subst Z: /D 2>$null
subst Z: "$real"

$env:VISHVA_JS_ROOT = "$real"
$env:VISHVA_BUILD_DIR = "$real\android\app\build"
$env:VISHVA_CODEGEN_DIR = "Z:\node_modules\@react-native\codegen"
$env:VISHVA_REACT_NATIVE_DIR = "Z:\node_modules\react-native"
$env:VISHVA_DISABLE_SOURCE_MAPS = "true"

Write-Host "[2/3] Building production release APK with arm64-v8a + x86_64 ABIs (v4.0.2 - versionCode 6)..."
Set-Location "Z:\android"
.\gradlew.bat assembleProductionRelease --no-daemon
$gradleExit = $LASTEXITCODE

Set-Location "$real"
subst Z: /D 2>$null

if ($gradleExit -ne 0) {
    Write-Host "BUILD FAILED with exit code $gradleExit"
    exit $gradleExit
}

if (Test-Path "$real\android\app\build\outputs\apk\production\release\app-production-release.apk") {
    Copy-Item -Force "$real\android\app\build\outputs\apk\production\release\app-production-release.apk" "$real\app-release.apk"
} elseif (Test-Path "$real\android\app\build\outputs\apk\productionRelease\app-production-release.apk") {
    Copy-Item -Force "$real\android\app\build\outputs\apk\productionRelease\app-production-release.apk" "$real\app-release.apk"
}

Write-Host "[3/3] BUILD OK - app-release.apk (v4.0.2)"
