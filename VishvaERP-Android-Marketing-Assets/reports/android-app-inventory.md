# Vishva ERP — Android App Screen Inventory

**Package:** `com.vishvaerp` · **App name:** Vishva ERP
**Target:** Android APK (NOT the website) — captured on Android emulator
**Device profile:** 1080 × 2400 px @ 420 dpi (status bar included in every shot)
**Last updated:** 2026-10-19

---

## 1. Summary

- **APK launched:** Yes (rebuilt x86_64 release from unchanged source — see §5)
- **Total screens discovered (route files):** 111
  - Role-scoped: 38 (student 6, faculty 7, parent 5, college_admin 16, super_admin 5)
  - Root/shared: 73 (incl. `index`, `landing`, `login`, `phone-login`, `screenshot-test`)
- **Screenshots captured + verified:** see §4
- **Role dashboards (5):** require manual login by account owner — see §6

---

## 2. Unauthenticated screens (captured & verified)

| # | Screen | Role / purpose | Navigation path | Filename | Features verified | Status |
|---|--------|----------------|------------------|----------|-------------------|--------|
| 01 | Splash | All users | App launch | `screenshots/01-splash-screen.png` | Blue branded splash, "Vi" logo | ✅ Verified |
| 02 | Onboarding landing | All users | Launch (first run) | `screenshots/02-onboarding-landing.png` | Hero value proposition | ✅ Verified |
| 03 | Onboarding features | All users | Swipe from landing | `screenshots/03-onboarding-features.png` | Feature highlights grid | ✅ Verified |
| 04 | Login | All users | Onboarding → Get started | `screenshots/04-login-screen.png` | Email/password fields, role link, register link, "Forgot password?" link | ✅ Verified |
| 05 | Register (top) | Student / Faculty / Parent | Login → Register | `screenshots/05-signup-register.png` | Role selector (Student/Faculty/Parent), personal fields | ✅ Verified |
| 06 | Register (scrolled) | Student / Faculty / Parent | Scroll on Register | `screenshots/06-signup-register-scroll.png` | College fields, password fields, submit | ✅ Verified |
| 07 | Login validation | All users | Login → submit empty/invalid | `screenshots/07-login-validation-errors.png` | Inline validation error states | ✅ Verified |
| 08 | Phone login / OTP | All users | Login → phone option | `screenshots/08-phone-login-otp.png` | Phone number entry, OTP request flow | ✅ Verified |

> **Build note:** All 8 shots re-captured on the rebuilt **v4.0.1 release**
> (x86_64+arm64 universal) so that every image in the promo set comes from a
> single build. The original v4.0.0 captures are preserved in
> `screenshots/_archive-v4.0.0/`.

**Known defect (source-verified):** "Forgot password?" on the login screen is a dead
placeholder — `onPress={() => {}}` in `frontend/app/login.tsx` (line 346). No
password-recovery route exists in the app. Exclude from the promo video.

---

## 3. Full route map (source of truth: `frontend/app/`)

### Role: Student — `/(student)`
| Screen | Path | Filename (planned) | Status |
|--------|------|--------------------|--------|
| Dashboard | `/(student)/dashboard` | `screenshots/dashboards/student-dashboard` | ⏳ Needs login |
| Timetable | `/(student)/timetable` | `screenshots/academic/student-timetable` | ⏳ Needs login |
| Assignments | `/(student)/assignments` | `screenshots/academic/student-assignments` | ⏳ Needs login |
| AI assistant | `/(student)/ai` | `screenshots/academic/student-ai` | ⏳ Needs login |
| Fees | `/(student)/fees` | `screenshots/academic/student-fees` | ⏳ Needs login |
| Profile | `/(student)/profile` | `screenshots/other/student-profile` | ⏳ Needs login |

### Role: Faculty — `/(faculty)`
| Screen | Path | Filename (planned) | Status |
|--------|------|--------------------|--------|
| Dashboard | `/(faculty)/dashboard` | `screenshots/dashboards/faculty-dashboard` | ⏳ Needs login |
| Classes | `/(faculty)/classes` | `screenshots/academic/faculty-classes` | ⏳ Needs login |
| Assignments | `/(faculty)/assignments` | `screenshots/academic/faculty-assignments` | ⏳ Needs login |
| Exam generator | `/(faculty)/exam-generator` | `screenshots/academic/faculty-exam-generator` | ⏳ Needs login |
| Question paper | `/(faculty)/question-paper` | `screenshots/academic/faculty-question-paper` | ⏳ Needs login |
| AI assistant | `/(faculty)/ai` | `screenshots/academic/faculty-ai` | ⏳ Needs login |
| Profile | `/(faculty)/profile` | `screenshots/other/faculty-profile` | ⏳ Needs login |

### Role: Parent — `/(parent)`
| Screen | Path | Filename (planned) | Status |
|--------|------|--------------------|--------|
| Dashboard | `/(parent)/dashboard` | `screenshots/dashboards/parent-dashboard` | ⏳ Needs login |
| Attendance | `/(parent)/attendance` | `screenshots/academic/parent-attendance` | ⏳ Needs login |
| Fees | `/(parent)/fees` | `screenshots/academic/parent-fees` | ⏳ Needs login |
| AI assistant | `/(parent)/ai` | `screenshots/academic/parent-ai` | ⏳ Needs login |
| Profile | `/(parent)/profile` | `screenshots/other/parent-profile` | ⏳ Needs login |

### Role: College Admin — `/(college_admin)`
| Screen | Path | Filename (planned) | Status |
|--------|------|--------------------|--------|
| Dashboard | `/(college_admin)/dashboard` | `screenshots/dashboards/college-admin-dashboard` | ⏳ Needs login |
| Users | `/(college_admin)/users` | `screenshots/administration/admin-users` | ⏳ Needs login |
| Attendance | `/(college_admin)/attendance` | `screenshots/administration/admin-attendance` | ⏳ Needs login |
| Academics | `/(college_admin)/academics` | `screenshots/administration/admin-academics` | ⏳ Needs login |
| Assessments | `/(college_admin)/assessments-admin` | `screenshots/administration/admin-assessments` | ⏳ Needs login |
| Reports | `/(college_admin)/reports` | `screenshots/administration/admin-reports` | ⏳ Needs login |
| Career hub | `/(college_admin)/career-hub` | `screenshots/administration/admin-career-hub` | ⏳ Needs login |
| Google settings | `/(college_admin)/google-settings` | `screenshots/administration/admin-google-settings` | ⏳ Needs login |
| Hostel admin | `/(college_admin)/hostel-admin` | `screenshots/administration/admin-hostel` | ⏳ Needs login |
| Mentorship admin | `/(college_admin)/mentorship-admin` | `screenshots/administration/admin-mentorship` | ⏳ Needs login |
| Payments | `/(college_admin)/payments` | `screenshots/administration/admin-payments` | ⏳ Needs login |
| Payment settings | `/(college_admin)/payment-settings` | `screenshots/administration/admin-payment-settings` | ⏳ Needs login |
| Placements | `/(college_admin)/placements` | `screenshots/administration/admin-placements` | ⏳ Needs login |
| Skill admin | `/(college_admin)/skill-admin` | `screenshots/administration/admin-skills` | ⏳ Needs login |
| Subscription | `/(college_admin)/subscription` | `screenshots/administration/admin-subscription` | ⏳ Needs login |
| Profile | `/(college_admin)/profile` | `screenshots/other/admin-profile` | ⏳ Needs login |

### Role: Super Admin — `/(super_admin)`
| Screen | Path | Filename (planned) | Status |
|--------|------|--------------------|--------|
| Dashboard | `/(super_admin)/dashboard` | `screenshots/dashboards/super-admin-dashboard` | ⏳ Needs login |
| Colleges | `/(super_admin)/colleges` | `screenshots/administration/superadmin-colleges` | ⏳ Needs login |
| Users | `/(super_admin)/users` | `screenshots/administration/superadmin-users` | ⏳ Needs login |
| Reports | `/(super_admin)/reports` | `screenshots/administration/superadmin-reports` | ⏳ Needs login |
| Profile | `/(super_admin)/profile` | `screenshots/other/superadmin-profile` | ⏳ Needs login |

### Root / shared screens (73)
Highlights reachable from role dashboards via in-app navigation (attendance,
exams, results, fees, library, hostel, transport/bus tracking, canteen, events,
chat, complaints, grievances, placements, career dashboard, resume builder,
exam-prep suite, study planner, notes, live classes, ID card, gate pass,
face enrollment, and more). These are captured opportunistically during role
walkthroughs as time allows, with filenames under `screenshots/other/`.

---

## 4. Captured screenshots

*(Updated as capture sessions progress.)*

---

## 5. Environment notes / limitations

- **AVD recreation:** The original emulator AVD (`Medium_Phone.avd`) was deleted
  from `C:\Users\shiva\.android\avd\` between Oct 16–18, 2026. The SDK has no
  `avdmanager`/`sdkmanager` (cmdline-tools absent), so the AVD was manually
  recreated from the already-installed system image
  (`android-37.2 google_apis_playstore_ps16k x86_64`) by rewriting the two config
  files. No downloads, no SDK changes, no app-code changes.
- **APK rebuild (necessary):** The only APK available on the machine
  (`frontend/app-release.apk`, 38.7 MB) contains **arm64-v8a native libraries
  only** and crashes on launch ("Vishva ERP keeps stopping") on the x86_64
  emulator (`couldn't find DSO to load: libreactnative.so`). No ARM64 emulator
  system image is available locally and there is no `sdkmanager` to fetch one.
  Therefore the release APK was rebuilt from the **unchanged source tree** with
  the project's own `gradle.properties` (`reactNativeArchitectures=x86_64`),
  producing an emulator-compatible universal build. No code, resource, or
  production-data modifications were made.
- **`uiautomator dump` is unusable** (React Native animations keep the view tree
  non-idle), so navigation is visual + exact-pixel taps via `tools/locate.ps1`.
- **Forgot password** is a non-functional placeholder in source (login.tsx:346).

---

## 6. Screens requiring manual login

All 5 role dashboards and their feature screens require real accounts:

1. Student
2. Faculty
3. College Admin
4. Super Admin
5. Parent

The emulator is handed to the account owner for manual credential entry — no
credentials are stored in any script, file, or log.
