# Vishva ERP v1.0.0

> **Your Entire Campus — In Your Pocket.**

The first AI-powered, full-stack campus management platform built for Indian colleges. One app for students, faculty, parents, college admins, and super admins — with real-time sync, 4 attendance methods, Razorpay payments, and 50+ features.

---

## Highlights

- **AI-Powered Everything** — Chat assistant, study planner, grade analyzer, attendance predictor, career advisor, resume builder, interview coach, question paper generator, assignment checker
- **4 Attendance Methods** — QR Code, GPS Geofencing, Face ID selfie, and Auto check-in
- **Real-Time Sync** — WebSocket live updates for attendance, fees, chat, and notifications
- **Razorpay Integration** — Instant fee payments with receipts, reminders, and webhook verification
- **Multi-Channel Notifications** — In-app, WhatsApp (Twilio), and email alerts
- **Live Bus Tracking** — Real-time transport monitoring with ETA and passenger count
- **Digital ID Card** — Animated flip card with QR code, barcode, download, share, and print
- **SaaS Subscription Model** — 3-tier plans for colleges (Basic / Pro / Enterprise)

---

## What's Included

### Student Features
- Dashboard with attendance, fees, GPA, and AI reminders
- AI Study Buddy — chat, planner, grade analyzer, attendance predictor
- Check in via QR, GPS, Face ID, or Auto
- Pay fees with Razorpay — instant receipts and history
- Digital ID card with animated flip, QR code, and download
- Timetable, assignments, exams, results, library, hostel, transport
- Real-time chat with classmates and faculty
- Notifications, email, WhatsApp integration
- Career advisor, resume builder, interview practice
- Analytics with GPA trends and subject-wise performance

### Faculty Features
- Start live attendance sessions with one tap
- Real-time check-in monitoring with student search
- AI question paper generator — select subject, difficulty, marks
- AI assignment grading with content/grammar/structure breakdown
- Exam generator from question banks with image upload
- Course and timetable management

### Parent Features
- Real-time attendance tracking with alerts
- Exam results and fee reminders
- WhatsApp notifications for important events
- Live bus tracking for child safety
- AI assistant to ask about child's progress

### College Admin Features
- Full user management — search, filter, add/edit/delete, bulk import
- Fee collection overview with Razorpay
- Campus-wide announcements
- Attendance reports and analytics dashboard
- Course and timetable management
- SaaS subscription management with Razorpay upgrade

### Super Admin Features
- Multi-college management
- Cross-college user oversight
- Platform-wide analytics

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native 0.81.5, New Architecture, TypeScript |
| Backend | Node.js + Express, MongoDB Atlas, Socket.IO |
| Auth | JWT + bcrypt, Twilio OTP (WhatsApp + SMS) |
| Payments | Razorpay (live keys) |
| AI | Built-in AI assistant (chat, planner, analyzer, predictor) |
| UI | Glassmorphism, Linear Gradient, BlurView, 16 custom components |
| Deployment | Render (backend), MongoDB Atlas (database) |

---

## Backend API Endpoints

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /auth/login`, `POST /auth/register`, `GET /auth/me`, `POST /auth/send-otp`, `POST /auth/verify-otp` |
| Dashboard | `GET /dashboard/student`, `GET /dashboard/faculty`, `GET /dashboard/parent`, `GET /dashboard/admin` |
| Academics | `GET /courses`, `GET /assignments`, `POST /assignments`, `GET /timetable` |
| Fees | `GET /fees`, `GET /fees/me`, `POST /fees/pay`, `POST /fees/verify` |
| Attendance | `GET /attendance/me`, `POST /attendance/session`, `POST /attendance/checkin`, `POST /attendance/override` |
| Notifications | `GET /notifications`, `POST /notifications` |
| Library | `GET /library/books`, `GET /library/issued` |
| Chat | `GET /chat/users`, `GET /chat/messages/:userId`, `POST /chat/messages/:userId` |
| AI | `POST /ai/chat`, `POST /ai/planner`, `POST /ai/grades`, `POST /ai/attendance` |
| Twilio | `POST /twilio/otp/send`, `POST /twilio/otp/verify`, `POST /twilio/whatsapp/send`, `POST /twilio/whatsapp/broadcast` |
| Admin | `GET /admin/users`, `POST /admin/users`, `PUT /admin/users/:id`, `DELETE /admin/users/:id` |
| Colleges | `GET /colleges`, `POST /colleges`, `PUT /colleges/:id`, `DELETE /colleges/:id` |
| Campus | `GET /hostels`, `GET /transport`, `GET /grievances`, `POST /grievances` |
| Health | `GET /health` |

---

## Security

- JWT authentication with 7-day expiry
- bcrypt password hashing (12 rounds)
- Rate limiting on auth routes (5 req/15min) and API (100 req/15min)
- Role-based access control (student, faculty, parent, college_admin, super_admin)
- CORS whitelist
- Input validation on all endpoints
- 0 npm vulnerabilities (overrides for tar and brace-expansion)
- Environment variables for all secrets (gitignored)

---

## Deployment

### Backend (Render)
- Auto-deploys from `master` branch
- Health check at `/health`
- Self-ping keep-alive every 5 minutes to prevent cold start sleep
- MongoDB Atlas connection with SRV + direct fallback

### Frontend (APK)
- Release APK built with ProGuard optimization
- Universal APK (no ABI splits — works on all architectures)
- New Architecture enabled (required by Reanimated 4.x)
- Built from `C:\dev\vfe` to avoid Windows 260-char path limit

---

## Getting Started

### Backend
```bash
cd backend
npm install
cp .env.example .env   # configure your env vars
node src/server.js      # starts on port 8000
```

### Frontend
```bash
cd frontend
npm install
npx react-native run-android
```

### Test API
```bash
cd backend
node test-api.js   # runs 25 endpoint tests
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB` | Database name (default: `test`) |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token expiry (default: `7d`) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp number |
| `RAZORPAY_KEY_ID` | Razorpay live key |
| `RAZORPAY_KEY_SECRET` | Razorpay live secret |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret |
| `CORS_ORIGINS` | Allowed CORS origins |

---

## Known Limitations

- Render free tier sleeps after ~15min inactivity (mitigated by self-ping)
- First request after sleep takes 30-60s (cold start)
- Debug keystore used for APK signing (not production keystore)
- Clean build may fail with CMake errors (incremental builds work)
- AI screens use built-in responses (no external AI API)

---

## What's Next

- [ ] Production keystore for release signing
- [ ] iOS build support
- [ ] External AI API integration (OpenAI/Gemini)
- [ ] Push notifications (FCM/APNs)
- [ ] Offline mode with local caching
- [ ] Multi-language support (Hindi, Tamil, Telugu)
- [ ] Admin analytics PDF export
- [ ] Attendance heatmap visualization

---

## License

MIT License — free to use, modify, and distribute.

---

**Built with ❤️ by [Shivam Kumar](https://github.com/Shivam852131)**

**Live Backend:** https://vishva-erp-app.onrender.com/health  
**GitHub:** https://github.com/Shivam852131/Vishva-ERP-App
