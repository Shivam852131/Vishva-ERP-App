# Vishva ERP — Advanced Features Documentation

> **50+ Features | 5 User Roles | AI-Powered | Real-Time Sync**

---

## Table of Contents

1. [Authentication & Security](#1-authentication--security)
2. [AI-Powered Intelligence Engine](#2-ai-powered-intelligence-engine)
3. [4-Method Attendance System](#3-4-method-attendance-system)
4. [Real-Time Communication Layer](#4-real-time-communication-layer)
5. [Payment & Financial Infrastructure](#5-payment--financial-infrastructure)
6. [Campus Management Ecosystem](#6-campus-management-ecosystem)
7. [Placement & Career Intelligence](#7-placement--career-intelligence)
8. [Live Class Infrastructure](#8-live-class-infrastructure)
9. [Admin & Analytics Dashboard](#9-admin--analytics-dashboard)
10. [Digital Identity System](#10-digital-identity-system)
11. [Library Management](#11-library-management)
12. [Multi-Tenant SaaS Architecture](#12-multi-tenant-saas-architecture)
13. [Push Notification Engine](#13-push-notification-engine)
14. [Analytics & Reporting](#14-analytics--reporting)
15. [Security & Compliance](#15-security--compliance)

---

## 1. Authentication & Security

### 1.1 Multi-Channel Login
- **Email/Password Authentication**: JWT-based with bcrypt hashing (12 rounds), 7-day token expiry
- **Phone OTP Login**: Twilio-powered SMS + WhatsApp OTP delivery with 6-digit codes, 5-minute expiry
- **Face Enrollment**: AI-powered face registration for biometric check-in

### 1.2 Role-Based Access Control (RBAC)
| Role | Permissions |
|------|-------------|
| **Student** | View own data, submit assignments, pay fees, chat, use AI tools |
| **Faculty** | Manage courses, create assignments, start attendance sessions, grade work |
| **Parent** | View child's attendance, fees, results; receive notifications |
| **College Admin** | Full user CRUD, fee management, reports, announcements, subscription |
| **Super Admin** | Multi-college management, platform analytics, cross-college oversight |

### 1.3 Security Infrastructure
- **Rate Limiting**: 5 requests/15min on auth routes, 100 requests/15min on API
- **CORS Whitelist**: Configurable allowed origins
- **Input Validation**: Zod schema validation on all endpoints
- **Helmet Headers**: HTTP security headers enabled
- **Environment Variables**: All secrets gitignored, never committed

---

## 2. AI-Powered Intelligence Engine

### 2.1 AI Chat Assistant
**6 Specialized Modes:**
1. **General Assistant**: Open-ended academic queries
2. **Doubt Solver**: Step-by-step problem resolution
3. **Academic Advisor**: Course selection and academic planning
4. **Study Coach**: Personalized study techniques and time management
5. **Code Helper**: Programming assistance and debugging
6. **Campus Guide**: Navigation and campus information

**Technical Implementation:**
- In-built response engine with contextual awareness
- Session persistence across conversations
- Role-specific response tailoring (student vs faculty vs parent)
- Conversation history stored in MongoDB

### 2.2 AI Study Planner
- **Input**: Subjects, exam dates, study hours available, difficulty levels
- **Output**: Day-by-day study schedule with time blocks
- **Features**:
  - Adaptive scheduling based on subject weightage
  - Break time optimization (Pomodoro integration)
  - Progress tracking with completion percentages
  - Rescheduling on missed study sessions

### 2.3 AI Grade Analyzer
- **Input**: Subject-wise marks across multiple assessments
- **Output**:
  - GPA trend visualization (line graph)
  - Subject-wise weakness identification
  - Improvement recommendations
  - Predicted final grade based on current trajectory
- **Analytics**:
  - Standard deviation analysis for class performance
  - Percentile ranking estimation
  - Subject correlation analysis

### 2.4 AI Attendance Predictor
- **Input**: Historical attendance data, class schedule, leave patterns
- **Output**:
  - Risk level assessment (Low/Medium/Critical)
  - Days until attendance shortage warning
  - Catch-up plan with required attendance targets
- **Alerts**:
  - Automatic warnings when attendance drops below 75%
  - Weekly attendance summary notifications

### 2.5 AI Question Paper Generator
- **Input**: Subject, difficulty level (Easy/Medium/Hard/Mixed), total marks, question count
- **Output**:
  - Structured question paper with sections
  - Bloom's taxonomy alignment
  - Mark distribution across topics
  - Model answer suggestions
- **Question Types**: MCQ, Short Answer, Long Answer, True/False, Fill in the Blanks

### 2.6 AI Assignment Grading
- **Input**: Student submission text
- **Output**:
  - Content score (1-10) with topic coverage analysis
  - Grammar score (1-10) with error highlighting
  - Structure score (1-10) with organization feedback
  - Overall grade with detailed rubric breakdown
- **Features**:
  - Plagiarism detection (basic pattern matching)
  - Word count and readability analysis
  - Improvement suggestions for resubmission

### 2.7 AI Career Advisor
- **Input**: Skills, interests, academic performance, experience
- **Output**:
  - Top 5 career path matches with probability scores
  - Skill gap analysis (current vs required)
  - Recommended courses and certifications
  - Resume optimization suggestions
  - Interview preparation materials

### 2.8 AI Resume Builder
- **Input**: Education, skills, projects, experience, certifications
- **Output**:
  - ATS-optimized resume template
  - Keyword optimization for job descriptions
  - Multiple format exports (PDF, DOCX)
  - Industry-specific templates

### 2.9 AI Interview Practice
- **Input**: Job role, company, difficulty level
- **Output**:
  - Common interview questions with model answers
  - Behavioral question STAR method coaching
  - Technical question drills
  - Performance scoring and improvement tips

---

## 3. 4-Method Attendance System

### 3.1 QR Code Attendance
**Flow:**
1. Faculty taps "Start Session" → generates unique QR code
2. QR code displays with 30-second auto-refresh
3. Students scan via app → GPS + timestamp recorded
4. Real-time counter updates (32/45 → 38/45 → 45/45)

**Technical Details:**
- QR code contains session ID + timestamp + HMAC signature
- Anti-replay protection (each scan is unique)
- Location validation (must be within campus geofence)
- Offline queue for scans with sync on reconnect

### 3.2 GPS Geofencing Attendance
**Flow:**
1. Admin defines classroom coordinates + radius (50-200m)
2. Student opens attendance screen → GPS coordinates captured
3. System validates location against geofence
4. Check-in recorded if within radius

**Technical Details:**
- Haversine formula for distance calculation
- Configurable accuracy threshold per classroom
- Battery optimization (low-power GPS mode)
- Fallback to cell tower triangulation when GPS unavailable

### 3.3 Face ID Attendance
**Flow:**
1. Student taps "Face Check-in" → camera activates
2. AI captures selfie → liveness detection (blink test)
3. Anti-spoofing check (photo/video rejection)
4. Face encoding matched against enrolled template
5. Match confidence > 90% → attendance recorded

**Technical Stack:**
- **TensorFlow.js** for ML inference
- **face-api.js** for face detection and recognition
- **Models Used**:
  - SSD MobileNetV1 (face detection)
  - FaceLandmark68 (68-point facial landmarks)
  - FaceRecognitionNet (128-dimensional face encoding)
  - FaceExpressionNet (emotion detection)
  - AgeGenderNet (age/gender estimation)
- **Anti-Spoofing**:
  - Texture analysis (LBP patterns)
  - Depth estimation (2D vs 3D face)
  - Motion detection (blink frequency)
  - Photo/video rejection algorithms

### 3.4 Auto Check-In
**Flow:**
1. Student enters campus geofence
2. Background service detects location change
3. Automatic check-in triggered for scheduled classes
4. Notification sent confirming attendance

**Technical Details:**
- Background geolocation service
- Smart scheduling (only checks during class hours)
- Battery-aware (reduces polling during idle)
- Manual override option

---

## 4. Real-Time Communication Layer

### 4.1 Socket.IO WebSocket Server
**Architecture:**
- Bidirectional event-driven communication
- Room-based broadcasting (per class, per user)
- Automatic reconnection with exponential backoff
- Heartbeat monitoring for connection health

**Real-Time Events:**
| Event | Direction | Description |
|-------|-----------|-------------|
| `attendance:update` | Server→Client | Live attendance count broadcast |
| `chat:message` | Bidirectional | 1:1 message delivery |
| `notification:new` | Server→Client | Push notification delivery |
| `fee:confirmed` | Server→Client | Payment confirmation |
| `live:class` | Bidirectional | Live session interactions |
| `presence:status` | Bidirectional | Online/offline status |

### 4.2 1:1 Chat System
- **Features**:
  - Real-time message delivery
  - Message timestamps and read receipts
  - User presence indicators (online/offline)
  - Message history persistence in MongoDB
  - Search across conversations
- **Participants**: Student↔Faculty, Student↔Student, Parent↔Faculty
- **Security**: JWT-authenticated WebSocket connections

### 4.3 Multi-Channel Notifications
1. **In-App Notifications**: Bell icon with unread count, notification center
2. **WhatsApp Integration**: Twilio-powered WhatsApp Business API
   - Automated fee reminders
   - Attendance alerts
   - Exam schedule notifications
   - Broadcast messages to groups
3. **Email Integration**: SMTP-based email delivery
4. **Push Notifications**: Firebase Cloud Messaging (FCM)
   - Background notification handling
   - Deep linking to relevant screens
   - Notification categories and priorities

---

## 5. Payment & Financial Infrastructure

### 5.1 Razorpay Integration
**Payment Flow:**
1. Student views fee dashboard → selects pending fee
2. Taps "Pay Now" → Razorpay checkout opens
3. Payment processed (UPI/Card/NetBanking/Wallet)
4. Webhook verification → receipt generated
5. Real-time confirmation via Socket.IO

**Features:**
- Multiple payment methods (UPI, Cards, NetBanking, Wallets)
- Automatic receipt generation with PDF export
- Payment history with filters (date, amount, status)
- Failed payment retry with automatic reconciliation
- Refund processing for overpayments

### 5.2 Fee Management
- **Fee Categories**: Tuition, Hostel, Library, Lab, Exam, Miscellaneous
- **Payment Plans**: Full payment, Installment (2/3/4 parts)
- **Late Fees**: Automatic late fee calculation after due date
- **Discounts**: Scholarship, sibling, early bird discounts
- **Reports**: Collection summary, defaulters list, category-wise breakdown

### 5.3 SaaS Subscription Model
**3-Tier Plans:**

| Feature | Basic (₹999/mo) | Pro (₹2,999/mo) | Enterprise (₹9,999/mo) |
|---------|-----------------|-----------------|------------------------|
| Students | 500 | 2,000 | Unlimited |
| Faculty | 50 | 200 | Unlimited |
| Storage | 10GB | 50GB | 200GB |
| Support | Email | Email + Chat | Priority Phone |
| AI Features | Basic | Advanced | Custom |
| Analytics | Standard | Advanced | Custom Reports |
| API Access | No | Yes | Yes + Custom |

**Subscription Management:**
- Razorpay subscription billing
- Automatic renewal with grace period
- Upgrade/downgrade with prorated billing
- Usage monitoring and alerts

---

## 6. Campus Management Ecosystem

### 6.1 Hostel Management
- **Room Allocation**: Manual and automatic assignment
- **Room Types**: Single, Double, Triple, Deluxe
- **Amenities Tracking**: AC, WiFi, Laundry, Mess
- **Complaint System**: Maintenance requests with priority
- **Visitor Management**: Check-in/out with host approval
- **Mess Menu**: Daily/weekly menu with feedback

### 6.2 Transport Management
- **Route Management**: Define bus routes with stops
- **Live Bus Tracking**: Real-time GPS tracking on map
- **ETA Calculation**: Predicted arrival time at each stop
- **Passenger Count**: Current bus occupancy
- **Driver Details**: Contact info, license, vehicle number
- **Route Optimization**: AI-suggested route improvements

### 6.3 Grievance/Complaint System
- **Categories**: Academic, Infrastructure, Food, Transport, Harassment
- **Priority Levels**: Low, Medium, High, Critical
- **Status Tracking**: Open → In Progress → Resolved → Closed
- **Anonymous Complaints**: Option for confidential reporting
- **Escalation**: Automatic escalation after 48 hours
- **Resolution SLA**: Defined response times per priority

### 6.4 Visitor Management
- **Pre-Registration**: Visitors registered before arrival
- **Check-In/Out**: QR code-based visitor tracking
- **Host Approval**: Notification to host for approval
- **ID Verification**: Government ID scanning
- **Visit History**: Complete visitor log for security

### 6.5 Asset Management
- **Asset Registry**: Equipment, furniture, vehicles
- **Maintenance Schedule**: Preventive maintenance tracking
- **Assignment Tracking**: Who has what asset
- **Depreciation Calculation**: Asset value tracking
- **Disposal Management**: End-of-life asset handling

---

## 7. Placement & Career Intelligence

### 7.1 Placement Drive Management
- **Drive Creation**: Company details, eligibility criteria, package
- **Eligibility Engine**: CGPA, backlogs, branch filtering
- **Student Registration**: One-click apply with profile snapshot
- **Round Management**: Online Test → Technical → HR → Offer
- **Status Tracking**: Applied → Shortlisted → Selected → Rejected

### 7.2 Skill Profile System
- **Skill Categories**: Technical, Soft Skills, Domain Expertise
- **Certifications**: Upload and verify certifications
- **Projects**: Portfolio with links and descriptions
- **Endorsements**: Peer and faculty endorsements
- **Skill Matching**: AI-powered job-skill matching

### 7.3 Skill Assessments
- **Question Bank**: 1000+ questions across domains
- **Assessment Types**: MCQ, Coding, Case Study
- **Timed Attempts**: Configurable time limits
- **Leaderboard**: Department-wide and college-wide rankings
- **Performance Analytics**: Time per question, accuracy trends

### 7.4 Mentorship Platform
- **Mentor Matching**: AI-based compatibility matching
- **Session Scheduling**: Calendar integration
- **Goal Setting**: Track mentorship objectives
- **Progress Tracking**: Milestone completion
- **Feedback Loop**: Post-session rating and comments

---

## 8. Live Class Infrastructure

### 8.1 Session Management
- **Scheduling**: Calendar-based session creation
- **Recurrence**: Daily, weekly, custom patterns
- **Room Assignment**: Virtual meeting room URLs
- **Capacity Limits**: Maximum participant controls

### 8.2 Real-Time Features
- **Participant Tracking**: Live attendee list with join/leave times
- **In-Class Chat**: Real-time messaging during sessions
- **Q&A Module**: Students submit questions, faculty answers
- **Polls**: Quick polls for engagement
- **Hand Raise**: Virtual hand raising for questions
- **Attention Tracking**: Participation metrics

### 8.3 Recording & Playback
- **Session Recording**: URL-based recording storage
- **Playback Access**: Role-based viewing permissions
- **Timestamp Markers**: Key moments tagged
- **Download Options**: Offline access for students

---

## 9. Admin & Analytics Dashboard

### 9.1 College Admin Dashboard
**Widgets:**
- Total Students / Faculty / Staff count
- Today's attendance percentage
- Fee collection (month/year)
- Recent activities feed
- Pending approvals count
- Active complaints

**User Management:**
- User listing with search, filter, sort
- Bulk user import via CSV
- Individual user CRUD operations
- Role assignment and permission management
- Account activation/deactivation

**Reports:**
- Attendance reports (daily/weekly/monthly)
- Fee collection reports
- Academic performance reports
- Placement statistics
- Custom date range filters

### 9.2 Super Admin Dashboard
**Platform Overview:**
- Total colleges registered
- Active subscriptions by tier
- Platform-wide user statistics
- Revenue analytics
- System health metrics

**Multi-College Management:**
- College CRUD operations
- Subscription assignment
- Cross-college analytics
- Platform configuration

---

## 10. Digital Identity System

### 10.1 Animated ID Card
- **Design**: Glassmorphism card with gradient background
- **Elements**:
  - Student photo with circular frame
  - Name, Roll Number, Department
  - College name and logo
  - QR code (encoded student data)
  - Barcode for scanner compatibility
  - Validity dates
- **Animation**: 3D flip animation on tap
- **Export Options**:
  - Save to device (PNG)
  - Share via apps (WhatsApp, Email)
  - Print-ready PDF
  - Screen capture via react-native-view-shot

### 10.2 QR Code Intelligence
- **Student QR**: Contains encrypted student ID + timestamp
- **Verification**: Scan to verify authenticity
- **Dynamic QR**: Refreshes every 30 seconds for security
- **Offline Support**: Cached QR for offline scanning

---

## 11. Library Management

### 11.1 Book Catalog
- **Search**: Title, author, ISBN, genre
- **Filtering**: Category, availability, language
- **Details**: Cover image, description, reviews
- **Availability**: Real-time stock status

### 11.2 Issue/Return System
- **Issue Flow**: Scan student ID → scan book → confirm
- **Return Flow**: Scan book → calculate fine → process return
- **Fine Calculation**: ₹5/day overdue (configurable)
- **Renewal**: Online book renewal option
- **Hold System**: Reserve currently issued books

### 11.3 Analytics
- Most borrowed books
- Peak borrowing times
- Student reading patterns
- Overdue trends

---

## 12. Multi-Tenant SaaS Architecture

### 12.1 Tenant Isolation
- **Database**: Shared database with tenant_id field
- **Data Segregation**: Query-level tenant filtering
- **Configuration**: Per-tenant feature flags
- **Customization**: White-label branding options

### 12.2 Subscription Billing
- **Plan Management**: Create/modify/delete plans
- **Usage Metering**: Track feature usage per tenant
- **Invoice Generation**: Automated monthly invoices
- **Payment Processing**: Razorpay subscription billing
- **Grace Period**: 7-day grace on failed payments

### 12.3 Scalability
- **Horizontal Scaling**: Stateless API servers
- **Database Optimization**: Indexed queries, connection pooling
- **Caching Layer**: Redis-ready architecture
- **CDN Support**: Static asset delivery optimization

---

## 13. Push Notification Engine

### 13.1 Firebase Cloud Messaging (FCM)
- **Device Registration**: Token-based device management
- **Topic Subscription**: Role-based topic broadcasting
- **Priority Levels**: High (urgent) vs Normal (informational)
- **Scheduled Notifications**: Time-based delivery
- **Rich Notifications**: Images, actions, deep links

### 13.2 Notification Categories
| Category | Trigger | Priority |
|----------|---------|----------|
| Attendance Alert | Below 75% | High |
| Fee Reminder | Due date approaching | High |
| Exam Schedule | New exam posted | Normal |
| Assignment Due | Deadline approaching | High |
| Chat Message | New message received | Normal |
| Placement Alert | New drive posted | Normal |
| Event Reminder | Upcoming event | Low |

### 13.3 WhatsApp Integration (Twilio)
- **Automated Messages**: Fee reminders, attendance alerts
- **Broadcast Lists**: Group messaging to classes/branches
- **Template Messages**: Pre-approved message templates
- **Delivery Reports**: Read/delivered status tracking

---

## 14. Analytics & Reporting

### 14.1 Student Analytics
- **GPA Trends**: Semester-wise GPA line graph
- **Subject Performance**: Radar chart per subject
- **Attendance Patterns**: Heatmap visualization
- **Fee History**: Payment timeline and projections
- **Skill Progress**: competency growth tracking

### 14.2 Faculty Analytics
- **Class Performance**: Average grades per section
- **Attendance Trends**: Class-wise attendance patterns
- **Assignment Metrics**: Submission rates, average scores
- **Teaching Load**: Hours per week breakdown

### 14.3 Admin Analytics
- **Collection Reports**: Fee collection by category
- **Enrollment Trends**: Student admission patterns
- **Placement Statistics**: Company-wise offers
- **Infrastructure Utilization**: Hostel, transport, library

### 14.4 Export Options
- PDF reports with charts
- CSV data export
- Scheduled report delivery
- Custom date range selection

---

## 15. Security & Compliance

### 15.1 Data Protection
- **Encryption**: HTTPS/TLS for all API communication
- **Password Hashing**: bcrypt with 12 salt rounds
- **Token Security**: JWT with short expiry (7 days)
- **API Keys**: Environment variable storage (never committed)

### 15.2 Access Control
- **RBAC**: Role-based middleware on all endpoints
- **Resource-Level**: Users can only access own data
- **Admin Oversight**: Audit logging for admin actions
- **Session Management**: Single session per user (configurable)

### 15.3 Infrastructure Security
- **Rate Limiting**: DDoS protection
- **Input Validation**: SQL injection/XSS prevention
- **CORS Policy**: Whitelist-based origin control
- **Security Headers**: Helmet.js HTTP headers
- **Dependency Auditing**: Regular npm audit checks

### 15.4 Compliance
- **Data Retention**: Configurable retention policies
- **Right to Deletion**: Account deletion endpoint
- **Audit Trail**: Complete action logging
- **Privacy Policy**: User consent management

---

## Technical Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    VISHVA ERP ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   FRONTEND   │    │   BACKEND    │    │   DATABASE   │   │
│  │ React Native │◄──►│  Node.js +   │◄──►│   MongoDB    │   │
│  │  TypeScript  │    │   Express    │    │   Atlas      │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                   │             │
│         ▼                   ▼                   ▼             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Socket.IO  │    │   TensorFlow │    │   Prisma     │   │
│  │   Client     │    │   .js + ML   │    │   (Postgres) │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                   │             │
│         ▼                   ▼                   ▼             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Firebase   │    │   Razorpay   │    │   Twilio     │   │
│  │   (FCM)      │    │   (Payments) │    │   (OTP/SMS)  │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

**Built with ❤️ by Shivam Kumar**

**GitHub:** https://github.com/Shivam852131/Vishva-ERP-App
**Live:** https://vishva-erp-app.onrender.com
