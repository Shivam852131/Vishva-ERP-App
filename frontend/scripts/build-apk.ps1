# ============================================================
#  Vishva ERP - Production release APK (PowerShell entry point)
#
#  Legacy name kept; all logic now lives in scripts\build.bat.
#  Same as: scripts\build.bat apk --no-clean
#
#  NOTE: the old version of this script pre-baked the JS bundle
#  into android\app\src\main\assets\ before running Gradle.
#  That step is gone on purpose - Gradle's own bundle task
#  (createBundleProductionReleaseJsAndAssets) generates a fresh
#  bundle into build\generated\assets, and a stale copy left in
#  src\main\assets can shadow or duplicate it. The release APK
#  must always ship the bundle built from the current source.
#
#  If an old pre-baked bundle is still lying around, delete it:
#    Remove-Item android\app\src\main\assets\index.android.bundle
# ============================================================

$ErrorActionPreference = 'Continue'
& "$PSScriptRoot\build.bat" apk --no-clean
exit $LASTEXITCODE
