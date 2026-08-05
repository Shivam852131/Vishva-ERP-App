export type UserRole = 'super_admin' | 'college_admin' | 'faculty' | 'student' | 'parent';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  college?: string;
  collegeName?: string;
  collegeId?: string;
  collegeCode?: string;
  collegeLogo?: string;
  department?: string;
  student_id?: string;
  year?: number;
  cgpa?: number;
  avatar?: string;
}

export interface LoginReq { email: string; password: string; }
export interface AuthResp { token: string; user: AuthUser; }

export interface AttendanceRecord {
  id: string; student_id: string; course_id: string; date: string;
  present: boolean; method: string;
}
export interface AttendanceByCourse {
  course_id: string; course_name: string; course_code: string;
  color: string; total: number; present: number; percentage: number;
}
export interface AttendanceData { records: AttendanceRecord[]; by_course: AttendanceByCourse[]; }

export interface Course {
  id: string; code: string; name: string; faculty_id?: string;
  faculty_name?: string; credits?: number; color?: string;
}

export interface TimetableSlot {
  id: string; day: string; start: string; end: string;
  course_id: string; course_name: string; course_code: string;
  faculty_name?: string; room?: string;
}

export interface Assignment {
  id: string; course_id: string; course_name: string; title: string;
  description: string; due_date: string; max_marks: number;
  created_by?: string; created_at?: string;
  submitted?: boolean; submission?: Submission | null;
}

export interface Submission {
  id: string; assignment_id: string; student_id: string;
  content: string; submitted_at: string; status: string;
}

export interface Note {
  id: string; course_id: string; course_name: string; title: string;
  type: string; url: string; uploaded_by?: string; created_at: string;
  class_name?: string; subject?: string; description?: string;
  downloads?: number; helpful_count?: number;
}

export interface ExamResult {
  id: string; course_id: string; course_name: string; course_code: string;
  marks: number; max_marks: number; grade: string; semester: string;
}

export interface Fee {
  id: string; student_id: string; type: string; amount: number;
  currency: string; due_date: string; status: string; paid_at?: string;
  semester?: string;
}

export interface Notification {
  id: string; audience: string; title: string; body: string;
  created_at: string; read_by?: string[]; read?: boolean;
}

export interface Event {
  id: string; title: string; date: string; venue: string; description: string;
}

export interface ChatMessage {
  id: string; from_id: string; from_name: string;
  to_id: string; message: string; created_at: string;
}

export interface ChatUser {
  id: string; name: string; email: string; role: string;
}

export interface College {
  id: string; name: string; code: string;
  students?: number; faculty?: number; admins?: number;
}

export interface StudentDashboardData {
  attendance: number; cgpa: number;
  pending_assignments: number; pending_fees: number;
  upcoming_classes: TimetableSlot[];
}

export interface FacultyDashboardData {
  courses: Course[]; students: number;
  today_classes: number; assignments: number;
}

export interface ParentDashboardData {
  child: AuthUser | null; attendance: number; cgpa: number;
  results: ExamResult[]; fees: Fee[];
}

export interface AdminDashboardData {
  students: number; faculty: number; parents: number;
  courses: number; colleges: number; pending_fees: number;
}

export interface AiChatMessage {
  id: string; session_id: string; user_msg: string;
  ai_msg: string; context?: string; created_at: string;
}

export interface AiReminder {
  id: string; type: string; priority: number;
  title: string; body: string;
}

export interface StudyPlan {
  id: string; plan_type: string; goal: string;
  plan: { title: string; days: PlanDay[]; tips: string[] };
  created_at: string;
}

export interface PlanDay {
  day: string; date: string; focus: string;
  tasks: PlanTask[];
}

export interface PlanTask {
  time: string; task: string; course: string; done?: boolean;
}

export interface Grievance {
  id: string; student_id: string; student_name: string;
  student_email: string; category: string; subject: string;
  description: string; is_anonymous: boolean; status: string;
  created_at: string; response?: string; resolved_at?: string;
}

export interface LibraryBook {
  id: string; title: string; author: string; isbn: string;
  category: string; total_copies: number; shelf_location: string;
}

export interface LibraryIssue {
  id: string; book_id: string; book_title: string;
  student_id: string; student_name: string;
  issued_at: string; due_date: string; returned_at?: string; fine: number;
}

export interface Hostel {
  id: string; name: string; type: string;
  total_rooms: number; occupied?: number; warden_name: string; contact: string;
  amenities?: string[]; description?: string; created_at?: string;
}

export interface HostelAllocation {
  id: string; hostel_id: string; hostel_name: string;
  room_number: string; student_id: string; student_name: string;
  student_email?: string; allocated_at: string; active: boolean;
}

export interface TransportRoute {
  id: string; route_name: string; vehicle_number: string;
  driver_name: string; driver_phone: string;
  stops: TransportStop[]; active: boolean;
}

export interface TransportStop {
  name: string; time: string;
}

export interface TransportEnrollment {
  id: string; route_id: string; route_name: string;
  vehicle_number: string; driver_name: string; driver_phone: string;
  stops: TransportStop[];
  student_id: string; student_name: string; active: boolean;
}

export interface Exam {
  id: string; course_id: string; course_name: string; course_code: string;
  exam_type: string; date: string; start_time: string; end_time: string;
  venue: string; max_marks: number;
}

export interface Placement {
  id: string; company: string; role: string; package: string;
  deadline: string; description: string; eligibility: string;
}

export interface Announcement {
  id: string; title: string; body: string;
  audience: string; created_by: string; created_at: string;
}

export interface FeePaymentIntent {
  session_id: string; url?: string; amount: number; currency: string;
}

export interface Classroom {
  id: string; name: string; building: string; floor: number;
  capacity: number; lat: number; lng: number; radius_m: number;
  beacons: Beacon[]; wifi_bssids: string[]; wifi_ssid_pattern: string;
  active: boolean; beacon_count?: number; wifi_count?: number; schedule_count?: number;
}

export interface Beacon {
  uuid: string; major: number; minor: number; name: string;
}

export interface ClassSchedule {
  id: string; college_id: string; course_id: string; course_name: string; course_code: string;
  faculty_id: string; faculty_name: string; classroom_id: string; classroom_name: string;
  day: string; start_time: string; end_time: string;
  attendance_method: string; grace_period_minutes: number; auto_notify_absent: boolean;
  active: boolean; enrolled_count?: number; classroom?: { name: string; lat: number; lng: number; radius_m: number };
}

export interface LiveClass {
  schedule: ClassSchedule; session_id: string | null;
  enrolled: number; checked_in: number; percentage: number;
}

export interface LiveStudentStatus {
  student_id: string; student_name: string; student_code: string;
  status: 'present' | 'late' | 'absent';
  check_in_time: string | null; check_out_time: string | null; method: string;
}

export interface AttendanceReport {
  period_days: number; total_students: number; total_sessions: number;
  overall_percentage: number; by_course: CourseAttendance[];
  trends: DailyTrend[]; low_attendance: LowAttendanceStudent[];
  patterns: AttendancePattern[];
}

export interface CourseAttendance {
  course_id: string; course_name: string; course_code: string; color: string;
  enrolled: number; total_records: number; present: number; percentage: number;
}

export interface DailyTrend {
  date: string; total: number; present: number; percentage: number;
}

export interface LowAttendanceStudent {
  student_id: string; student_name: string; student_code: string;
  email: string; percentage: number; total: number; present: number;
}

export interface AttendancePattern {
  type: string; description: string; severity: 'low' | 'medium' | 'high';
  affected_students?: any[];
}

export interface NotificationQueueItem {
  id: string; recipient_id: string; recipient_type: string;
  channels: string[]; title: string; body: string;
  status: string; attempts: number; created_at: string;
}

// ─── Live Classes ────────────────────────────────────────────────
export interface LiveSession {
  id: string; title: string; description: string;
  course_id: string | null; course_name: string | null;
  host_id: string; host_name: string;
  scheduled_at: string; started_at: string | null; ended_at: string | null;
  duration_minutes: number; status: 'scheduled' | 'live' | 'ended';
  meeting_url: string | null; recording_url: string | null;
  allow_chat: boolean; allow_questions: boolean;
  department: string | null; year: number | null; tags: string[];
  materials: string[]; created_at: string;
  participant_count?: number; active_count?: number;
  joined?: boolean; is_host?: boolean;
}

export interface LiveParticipant {
  id: string; student_id: string; student_name: string;
  joined_at: string; left_at: string | null; active: boolean;
  hand_raised: boolean; attention_seconds: number; present: boolean;
}

export interface LiveMessage {
  id: string; text: string; author_id: string;
  author_name: string; author_role: string; created_at: string;
}

export interface LiveQuestion {
  id: string; text: string; author_id: string; author_name: string;
  anonymous: boolean; upvotes: number; upvoted: boolean;
  answered: boolean; answer: string | null; created_at: string;
}

export interface LivePoll {
  id: string; question: string; options: string[];
  votes: number[]; total_votes: number; my_vote: number | null;
  status: 'open' | 'closed'; created_at: string;
}

export interface LiveSessionDetail extends LiveSession {
  participants: LiveParticipant[];
  questions: LiveQuestion[];
  polls: LivePoll[];
}

// ─── Placement ───────────────────────────────────────────────────
export interface EligibilityCheck {
  key: string; label: string; required: string;
  actual: string; passed: boolean; unverified?: boolean;
}

export interface DriveEligibility {
  eligible: boolean;
  checks: EligibilityCheck[];
  failed_checks: string[];
  skill_gaps: { skill_key: string; name: string; score: number }[];
  skill_readiness: number;
}

export interface PlacementDrive {
  id: string; company: string; role: string; sector: string | null;
  package_lpa: number; package_label: string; location: string;
  job_type: string; description: string;
  min_cgpa: number | null; min_attendance: number | null; max_backlogs: number | null;
  allowed_departments: string[];
  required_skills: { skill_key: string; name: string }[];
  rounds: string[]; deadline: string; drive_date: string | null;
  openings: number | null; status: string; application_count: number;
  created_at: string;
  eligibility: DriveEligibility;
  applied: boolean; application_status: string | null; application_id: string | null;
  days_left: number; closing_soon?: boolean;
}

export interface ApplicationRound {
  name: string; status: string; scheduledAt: string | null; feedback: string | null;
}

export interface PlacementApplication {
  id: string; drive_id: string; student_id: string; student_name: string;
  company: string; role: string; package_label: string;
  status: string; current_round: number; rounds: ApplicationRound[];
  resume_url: string | null; cover_note: string | null;
  applied_at: string; updated_at: string; offer: any | null;
  timeline: { event: string; at: string; note: string | null }[];
  drive?: PlacementDrive | null;
}

export interface PlacementStats {
  open_drives: number; total_drives: number; applications: number;
  shortlisted: number; in_process: number; offers: number; rejected: number;
  conversion_rate: number; highest_package: number; average_package: number;
  by_stage: { stage: string; count: number }[];
  top_recruiters: { company: string; count: number }[];
}

// ─── Assessments ─────────────────────────────────────────────────
export interface Assessment {
  id: string; key: string; title: string; description: string;
  skill_key: string; skill_name: string; category: string;
  duration_minutes: number; total_questions: number;
  pass_score: number; difficulty: string; attempts: number;
  my_attempts: number; best_score: number | null; passed: boolean;
  in_progress_attempt_id: string | null;
}

export interface AttemptQuestion {
  index: number; question: string; options: string[]; difficulty: string;
}

export interface AssessmentAttempt {
  attempt_id: string; assessment: Assessment;
  started_at: string; expires_at: string; seconds_remaining: number;
  answers: Record<string, number>;
  questions: AttemptQuestion[];
}

export interface AssessmentResult {
  attempt_id: string; assessment: Assessment;
  score_percent: number; correct: number; total: number; passed: boolean;
  time_taken_seconds: number; submitted_at: string; certificate_id: string | null;
  breakdown: {
    index: number; question: string; options: string[]; difficulty: string;
    correct_index: number; selected_index: number | null; correct: boolean;
  }[];
  by_difficulty: { difficulty: string; total: number; correct: number; percent: number }[];
  skill?: SkillEntry;
}

export interface AssessmentHistoryItem {
  id: string; assessment_id: string; assessment_title: string;
  skill_key: string; score_percent: number; correct: number; total: number;
  passed: boolean; time_taken_seconds: number; submitted_at: string;
}

export interface LeaderboardRow {
  rank: number; student_id: string; student_name: string;
  best_score: number; average_score: number;
  attempts: number; passed: number; is_me: boolean;
}

// ─── Skill Profile ───────────────────────────────────────────────
export interface SkillEntry {
  skill_key: string; name: string; category: string;
  score: number; level: string; level_label: string;
  self_rating: number | null; assessment_score: number | null;
  assessment_count: number; endorsement_count: number;
  verified: boolean; updated_at: string | null;
}

export interface SkillProfile {
  skills: SkillEntry[];
  summary: {
    total_skills: number; verified_skills: number; average_score: number;
    top_skill: SkillEntry | null; certifications: number;
    projects: number; endorsements: number;
  };
  certifications: {
    id: string; title: string; issuer: string; skill_key: string | null;
    credential_id: string | null; credential_url: string | null;
    issued_at: string; expires_at: string | null; source: string;
  }[];
  projects: {
    id: string; title: string; description: string; skills: string[];
    repo_url: string | null; demo_url: string | null; created_at: string;
  }[];
  endorsements: {
    id: string; skill_key: string; endorser_name: string;
    endorser_role: string; note: string | null; created_at: string;
  }[];
}

export interface SkillCatalogItem {
  skill_key: string; name: string; category: string;
}

// ─── Mentorship ──────────────────────────────────────────────────
export interface Mentor {
  id: string; name: string; headline: string; company: string; bio: string;
  expertise: { skill_key: string; name: string }[];
  career_tracks: { key: string; title: string }[];
  experience_years: number; languages: string[]; availability: string[];
  rating: number; sessions_completed: number; is_active: boolean;
  relevance?: number;
  connection_status: string | null; connection_id: string | null;
  reviews?: { student_name: string; rating: number; feedback: string; at: string }[];
}

export interface MentorshipConnection {
  id: string; mentor_id: string; mentor_name: string; mentor_headline: string;
  student_id: string; student_name: string; status: string; goal: string;
  focus_skills: { skill_key: string; name: string }[];
  message: string | null; decline_reason: string | null;
  requested_at: string; responded_at: string | null; sessions_count: number;
}

export interface MentorshipSession {
  id: string; connection_id: string; mentor_id: string; mentor_name: string;
  student_id: string; student_name: string; topic: string; agenda: string;
  scheduled_at: string; duration_minutes: number; meeting_url: string | null;
  status: string; notes: string | null; action_items: string[];
  rating: number | null; feedback: string | null; created_at: string;
}

export interface MentorshipGoal {
  id: string; connection_id: string | null; title: string; description: string;
  skill_key: string | null; target_date: string | null; status: string;
  progress: number; milestones: { title: string; done: boolean }[];
  created_at: string; completed_at: string | null;
}

export interface MentorshipOverview {
  stats: {
    active_mentors: number; pending_requests: number;
    upcoming_sessions: number; completed_sessions: number;
    total_hours: number; active_goals: number; completed_goals: number;
  };
  next_session: MentorshipSession | null;
  connections: MentorshipConnection[];
  upcoming_sessions: MentorshipSession[];
  goals: MentorshipGoal[];
}

// ─── Career Dashboard ────────────────────────────────────────────
export interface CareerPillar {
  key: string; label: string; weight: number; score: number; detail: string;
}

export interface CareerMatch {
  key: string; title: string; category: string; description: string;
  salary_range: string; growth: number; education: string; match: number;
  core_skills: { skill_key: string; name: string; score: number; verified: boolean; required: boolean }[];
  support_skills: { skill_key: string; name: string; score: number; verified: boolean; required: boolean }[];
  gaps: { skill_key: string; name: string; score: number; gap: number }[];
}

export interface CareerDashboard {
  readiness_score: number; readiness_label: string;
  pillars: CareerPillar[];
  top_matches: CareerMatch[];
  skill_gaps: { skill_key: string; name: string; score: number; gap: number }[];
  pipeline: { stage: string; count: number }[];
  trend_month?: number;
  trend_peers?: number;
  stats: {
    applications: number; active_applications: number; offers: number;
    assessments_passed: number; assessments_taken: number;
    verified_skills: number; certifications: number; projects: number;
    active_mentors: number; upcoming_sessions: number;
  };
  upcoming_sessions: {
    id: string; topic: string; mentor_name: string;
    scheduled_at: string; duration_minutes: number;
  }[];
  recommendations: {
    key: string; priority: string; title: string; body: string; action: string;
  }[];
  recent_activity: { type: string; title: string; at: string; status: string }[];
}
