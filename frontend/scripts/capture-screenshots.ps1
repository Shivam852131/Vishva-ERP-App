# capture-screenshots.ps1
# Auto-capture screenshots from emulator while the app auto-navigates
# Usage:
#   1. Start emulator: .\capture-screenshots.ps1 -StartEmulator
#   2. Install APK:    .\capture-screenshots.ps1 -InstallApk
#   3. Capture:        .\capture-screenshots.ps1 -Capture
#   4. All-in-one:     .\capture-screenshots.ps1 -All

param(
    [switch]$StartEmulator,
    [switch]$InstallApk,
    [switch]$Capture,
    [switch]$All
)

$ADB = "C:\Users\shiva\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$EMULATOR = "C:\Users\shiva\AppData\Local\Android\Sdk\emulator\emulator.exe"
$AVD_NAME = "Small_Phone"
$APK_PATH = "C:\Users\shiva\OneDrive\Desktop\vishva ERP app\frontend\app-release.apk"
$SCREENSHOT_DIR = "C:\Users\shiva\OneDrive\Desktop\vishva ERP app\screenshots"
$DELAY_SEC = 2.8

$SCREENS = @(
    "00_landing", "01_login", "02_phone_login",
    "03_student_dashboard", "04_student_timetable", "05_student_assignments", "06_student_ai", "07_student_profile",
    "08_student_fees", "09_attendance", "10_attendance_advanced", "11_exams", "12_results", "13_id_card",
    "14_face_enroll", "15_library", "16_hostel", "17_transport", "18_bus_tracking", "19_leave_management",
    "20_grievances", "21_events", "22_notes", "23_live_classes", "24_live_class", "25_chat",
    "26_analytics", "27_scan", "28_selfie", "29_career_dashboard", "30_career_advisor", "31_skill_profile",
    "32_skill_assessment", "33_assessment_attempt", "34_mentorship", "35_placement", "36_report_card",
    "37_assignment_checker", "38_resume_builder", "39_interview_practice", "40_study_planner",
    "41_notifications", "42_push_notifications", "43_email", "44_whatsapp", "45_edit_profile",
    "46_faculty_dashboard", "47_faculty_classes", "48_faculty_assignments", "49_faculty_ai", "50_faculty_profile",
    "51_exam_generator", "52_question_paper", "53_start_session", "54_session", "55_attendance_live", "56_attendance_live_advanced",
    "57_parent_dashboard", "58_parent_attendance", "59_parent_fees", "60_parent_ai", "61_parent_profile",
    "62_admin_dashboard", "63_admin_users", "64_admin_attendance", "65_admin_academics", "66_admin_reports", "67_admin_profile",
    "68_payments", "69_payment_settings", "70_subscription", "71_hostel_admin", "72_career_hub",
    "73_placements", "74_assessments_admin", "75_mentorship_admin", "76_skill_admin",
    "77_visitor", "78_complaints", "79_assets",
    "80_super_admin_overview", "81_colleges", "82_super_admin_users", "83_super_admin_reports", "84_super_admin_profile"
)

function Start-Emulator {
    Write-Host "Starting emulator: $AVD_NAME" -ForegroundColor Cyan
    Start-Process -FilePath $EMULATOR -ArgumentList "-avd", $AVD_NAME -WindowStyle Normal
    Write-Host "Waiting for emulator to boot (60s)..." -ForegroundColor Yellow
    & $ADB wait-for-device
    Start-Sleep -Seconds 30
    Write-Host "Emulator ready!" -ForegroundColor Green
}

function Install-App {
    Write-Host "Installing APK..." -ForegroundColor Cyan
    & $ADB install -r "$APK_PATH"
    Write-Host "APK installed!" -ForegroundColor Green
}

function Capture-Screenshots {
    if (-not (Test-Path $SCREENSHOT_DIR)) {
        New-Item -ItemType Directory -Path $SCREENSHOT_DIR -Force | Out-Null
    }

    Write-Host "Capturing $($SCREENS.Count) screenshots..." -ForegroundColor Cyan
    Write-Host "Make sure the app is open and you are on the /__screenshots screen!" -ForegroundColor Yellow
    Write-Host "Press Enter to start capture..." -ForegroundColor Yellow
    Read-Host

    for ($i = 0; $i -lt $SCREENS.Count; $i++) {
        $name = $SCREENS[$i]
        $localPath = "$SCREENSHOT_DIR\$name.png"
        $devicePath = "/sdcard/screenshot_current.png"

        & $ADB shell screencap -p $devicePath
        & $ADB pull $devicePath $localPath 2>$null

        $pct = [math]::Round((($i + 1) / $SCREENS.Count) * 100)
        Write-Host "[$($i+1)/$($SCREENS.Count)] $pct% - $name" -ForegroundColor Green

        Start-Sleep -Seconds $DELAY_SEC
    }

    Write-Host "Done! Screenshots saved to $SCREENSHOT_DIR" -ForegroundColor Green
}

if ($All) {
    Start-Emulator
    Install-App
    Capture-Screenshots
} elseif ($StartEmulator) {
    Start-Emulator
} elseif ($InstallApk) {
    Install-App
} elseif ($Capture) {
    Capture-Screenshots
} else {
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\capture-screenshots.ps1 -StartEmulator    # Start emulator only"
    Write-Host "  .\capture-screenshots.ps1 -InstallApk       # Install APK only"
    Write-Host "  .\capture-screenshots.ps1 -Capture           # Start capturing"
    Write-Host "  .\capture-screenshots.ps1 -All               # Do everything"
}
