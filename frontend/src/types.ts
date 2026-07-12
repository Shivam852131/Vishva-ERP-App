export type UserRole = 'super_admin' | 'college_admin' | 'faculty' | 'student' | 'parent';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  college?: string;
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
  total_rooms: number; warden_name: string; contact: string;
}

export interface HostelAllocation {
  id: string; hostel_id: string; hostel_name: string;
  room_number: string; student_id: string; student_name: string;
  allocated_at: string; active: boolean;
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
