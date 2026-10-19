# Vishva ERP — Android Marketing Assets

High-fidelity screenshots of the **Vishva ERP Android app** (package
`com.vishvaerp`), captured on an Android emulator for use in promotional
material (Instagram Reel, 60–90 s).

> **Scope note:** Every image here is a capture of the **Android APK**, not the
> website. The website (https://vishvaerp.vercel.app/) was used only as a
> feature reference.

---

## Folder structure

```
VishvaERP-Android-Marketing-Assets/
├── screenshots/
│   ├── dashboards/        # Role dashboards (Student, Faculty, Parent, Admin, Super Admin)
│   ├── academic/          # Timetable, assignments, exams, attendance, fees, AI…
│   ├── administration/    # User management, reports, payments, hostel, placements…
│   └── other/             # Profiles, onboarding, auth, misc root screens
├── reports/
│   └── android-app-inventory.md   # Full screen inventory + capture status
├── tools/
│   ├── cap.ps1            # Byte-safe screenshot capture via ADB
│   └── locate.ps1         # Pixel-accurate UI element locator (colour-region scan)
└── README.md              # This file
```

## Capture standard

| Property | Value |
|----------|-------|
| Device | Android emulator (Medium Phone profile) |
| Resolution | 1080 × 2400 px |
| Density | 420 dpi |
| Status bar | Included |
| Format | PNG, unmodified (byte-verified `89 50 4E 47` header) |
| Naming | `NN-descriptive-name.png` (sequential, role-prefixed for role screens) |

Every PNG is verified after capture (valid header + size check) before it is
counted as captured.

## How screenshots are captured

```powershell
# Capture current screen into screenshots/<subdir>/<name>.png
.\tools\cap.ps1 -Name "student-dashboard" -SubDir "dashboards" -WaitMs 800

# Find exact pixel coordinates of a UI colour region before tapping
.\tools\locate.ps1 -Hex "#1D4ED8" -Region "0,1800,1080,600"
```

Taps are issued with exact pixel coordinates from `locate.ps1` — visual
estimates proved unreliable on the 1080 × 2400 canvas.

## Rules honoured during capture

- No app code, resources, or production data were modified.
- No credentials are stored in any script, file, or log — login is performed
  manually by the account owner on the emulator.
- No records were created/updated/submitted in any live system during
  exploration; only read-only navigation.
- The app's APK was rebuilt once (from unchanged source) solely because the
  only APK on the machine contained arm64-only native libraries that crash on
  the x86_64 emulator — see `reports/android-app-inventory.md` §5.

## Known app findings worth noting

- **"Forgot password?"** on the login screen is a dead placeholder
  (`frontend/app/login.tsx:346`, `onPress={() => {}}`) — no recovery route
  exists. Keep it out of the promo video.
- Register screen supports **Student / Faculty / Parent** self-signup roles.

## Promotional video usage

See `reports/promo-video-plan.md` for a shot list, pacing, and platform
guidance (Instagram Reel 9:16).
