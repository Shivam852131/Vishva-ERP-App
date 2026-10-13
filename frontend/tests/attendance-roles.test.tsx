import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockChild = {
  id: 'c-1',
  name: 'Aarav Sharma',
  department: 'Computer Science',
  year: 3,
  student_id: '22CSE041',
  role: 'student',
};

const mockByCourse = [
  {
    course_id: 'crs-1',
    course_code: 'CS301',
    course_name: 'Database Systems',
    total: 20,
    present: 14,
    percentage: 70,
  },
  {
    course_id: 'crs-2',
    course_code: 'CS302',
    course_name: 'Operating Systems',
    total: 24,
    present: 22,
    percentage: 92,
  },
];

const mockRecords = [
  {
    id: 'r-1',
    date: new Date().toISOString().split('T')[0],
    courseName: 'Database Systems',
    status: 'present',
  },
  {
    id: 'r-2',
    date: new Date().toISOString().split('T')[0],
    courseName: 'Operating Systems',
    status: 'absent',
  },
];

const mockClassrooms = [
  {
    id: 'room-1',
    name: 'Newton Hall 301',
    building: 'Science Block',
    floor: 3,
    capacity: 60,
    lat: 28.6139,
    lng: 77.209,
    radius_m: 35,
    beacon_count: 2,
    wifi_count: 3,
    schedule_count: 4,
  },
];

const mockSchedules = [
  {
    id: 'sched-1',
    day: 'monday',
    start_time: '09:00',
    end_time: '10:00',
    course_code: 'CS301',
    course_name: 'Database Systems',
    faculty_name: 'Dr. Ramesh Gupta',
    classroom_name: 'Newton Hall 301',
    attendance_method: 'auto',
    grace_period_minutes: 10,
  },
];

const mockLiveSession = {
  active_classes: [
    {
      session_id: 'sess-1',
      percentage: 85,
      checked_in: 34,
      enrolled: 40,
      schedule: {
        id: 'sched-1',
        course_name: 'Database Systems',
        classroom_name: 'Newton Hall 301',
        faculty_name: 'Dr. Ramesh Gupta',
      },
    },
  ],
  total_enrolled: 120,
  total_present: 98,
};

const mockDailyReport = {
  date: '2026-09-06',
  overall_percentage: 88,
  total_present: 98,
  total_absent: 22,
  total_enrolled: 120,
};

const mockFacultySessions = [
  {
    id: 'sess-1',
    course_name: 'Database Systems',
    method: 'qr',
    code: '839201',
    starts_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 600000).toISOString(),
    active: true,
    checkins: 18,
  },
  {
    id: 'sess-2',
    course_name: 'Operating Systems',
    method: 'gps',
    code: '192834',
    starts_at: new Date(Date.now() - 86400000).toISOString(),
    expires_at: new Date(Date.now() - 80000000).toISOString(),
    active: false,
    checkins: 38,
  },
];

const mockLiveDataDetail = {
  schedule: {
    course_name: 'Database Systems',
    classroom_name: 'Newton Hall 301',
    day: 'Monday',
    start_time: '09:00',
    end_time: '10:00',
  },
  present: 34,
  late: 2,
  absent: 4,
  percentage: 85,
  total_enrolled: 40,
  students: [
    {
      student_id: 's-1',
      student_name: 'Aarav Sharma',
      student_code: '22CSE041',
      status: 'present',
      time: '09:05 AM',
      method: 'qr',
    },
    {
      student_id: 's-2',
      student_name: 'Rohan Verma',
      student_code: '22CSE042',
      status: 'absent',
      time: '',
      method: '',
    },
  ],
};

jest.mock('@/src/api', () => ({
  api: jest.fn((url: string) => {
    if (url.includes('/admin/attendance/live/')) {
      return Promise.resolve(mockLiveDataDetail);
    }
    return Promise.resolve(null);
  }),
  apiUrl: (p: string) => p,
  getToken: jest.fn(() => Promise.resolve('mock-token')),
}));

jest.mock('@/src/hooks/useFetch', () => ({
  useFetch: jest.fn((url: string) => {
    if (url === '/dashboard/parent') {
      return {
        data: { child: mockChild, attendance: 82, cgpa: 8.7, results: [], fees: [] },
        loading: false,
        error: null,
        refresh: jest.fn(),
      };
    }
    if (url === '/attendance/me') {
      return {
        data: { records: mockRecords, by_course: mockByCourse },
        loading: false,
        error: null,
        refresh: jest.fn(),
      };
    }
    if (url === '/attendance/leave-requests') {
      return {
        data: [
          { id: 'l-1', date: '2026-09-10', reason: 'Fever checkup', status: 'approved', course_name: 'Database Systems' },
        ],
        loading: false,
        error: null,
        refresh: jest.fn(),
      };
    }
    if (url === '/classrooms') {
      return { data: mockClassrooms, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/schedules') {
      return { data: mockSchedules, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/attendance/live') {
      return { data: mockLiveSession, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/attendance/daily') {
      return { data: mockDailyReport, loading: false, error: null, refresh: jest.fn() };
    }
    if (url?.includes('/attendance/reports')) {
      return {
        data: {
          period_days: 30,
          overall_percentage: 84,
          total_sessions: 140,
          total_students: 450,
          low_attendance: [{ student_name: 'Rohan Verma', percentage: 68 }],
          by_course: [{ course_code: 'CS301', percentage: 70 }],
          patterns: [{ severity: 'high', description: 'Friday afternoon attendance drops by 18%' }],
        },
        loading: false,
        error: null,
        refresh: jest.fn(),
      };
    }
    if (url === '/courses') {
      return {
        data: [{ id: 'crs-1', code: 'CS301', name: 'Database Systems', faculty_id: 'f-1' }],
        loading: false,
        error: null,
        refresh: jest.fn(),
      };
    }
    if (url === '/admin/users?role=faculty') {
      return {
        data: [{ id: 'f-1', name: 'Dr. Ramesh Gupta', email: 'ramesh@example.com' }],
        loading: false,
        error: null,
        refresh: jest.fn(),
      };
    }
    if (url === '/attendance/sessions/mine') {
      return { data: mockFacultySessions, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/attendance/sessions/active') {
      return {
        data: { sessions: [mockFacultySessions[0]], face_enrolled: true },
        loading: false,
        error: null,
        refresh: jest.fn(),
      };
    }
    if (url === '/attendance/analytics') {
      return {
        data: { streak: 7, max_streak: 15, weekly_trend: 2.5, monthly_trend: 4.1 },
        loading: false,
        error: null,
        refresh: jest.fn(),
      };
    }
    return { data: null, loading: false, error: null, refresh: jest.fn() };
  }),
  useMutate: jest.fn(() => ({
    mutate: jest.fn(() => Promise.resolve({ ok: true })),
    loading: false,
    error: null,
  })),
}));

jest.mock('@/src/navigation/router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ sid: 'sess-1', id: 'sess-1' }),
}));

jest.mock('@/src/providers/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-1',
      name: 'Test User',
      role: 'student',
    },
    loading: false,
  }),
}));

jest.mock('@/src/realtime/socket', () => ({
  subscribeRealtime: jest.fn(() => () => {}),
}));

jest.mock('@/src/native/location', () => ({
  Accuracy: { Balanced: 'balanced' },
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
  requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: 28.6139, longitude: 77.2090 } })),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
}));

jest.mock('@/src/native/haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('react-native-qrcode-svg', () => {
  const { View } = require('react-native');
  return (props: any) => <View {...props} testID="mock-qr-code" />;
});

// Components under test
import ParentAttendanceScreen from '@/app/(parent)/attendance';
import CollegeAdminAttendanceScreen from '@/app/(college_admin)/attendance';
import StudentAttendanceScreen from '@/app/attendance';
import FacultyClassesScreen from '@/app/(faculty)/classes';
import LiveAttendanceScreen from '@/app/attendance-live';

describe('Advanced Attendance Role Suite', () => {
  describe('1. Parent Role: ParentAttendanceScreen', () => {
    it('renders dedicated parent portal with ward identity and health gauge', () => {
      const { getByText } = render(<ParentAttendanceScreen />);
      expect(getByText('Ward Attendance')).toBeTruthy();
      expect(getByText('Parental Oversight')).toBeTruthy();
      expect(getByText('Aarav Sharma')).toBeTruthy();
      expect(getByText('Apply Leave')).toBeTruthy();
    });

    it('displays course breakdown and leaves tab', () => {
      const { getByText } = render(<ParentAttendanceScreen />);
      expect(getByText('Summary')).toBeTruthy();
      expect(getByText(/Courses/)).toBeTruthy();
      expect(getByText(/Recent/)).toBeTruthy();
      expect(getByText(/Leaves/)).toBeTruthy();
    });
  });

  describe('2. College Admin Role: CollegeAdminAttendanceScreen', () => {
    it('renders Executive Command Center with KPI metrics and live radar', () => {
      const { getByText, getAllByText } = render(<CollegeAdminAttendanceScreen />);
      expect(getByText('Attendance Command Center')).toBeTruthy();
      expect(getByText('Campus Operations & Compliance')).toBeTruthy();
      expect(getAllByText('Overview')[0]).toBeTruthy();
      expect(getByText('Rooms')).toBeTruthy();
      expect(getAllByText('Schedules')[0]).toBeTruthy();
      expect(getByText('Live Radar')).toBeTruthy();
      expect(getAllByText('Reports')[0]).toBeTruthy();
    });

    it('displays campus metrics and department comparison', () => {
      const { getByText } = render(<CollegeAdminAttendanceScreen />);
      expect(getByText('Overall Attendance Rate')).toBeTruthy();
      expect(getByText('Active Rooms')).toBeTruthy();
      expect(getByText('Department Attendance Comparison')).toBeTruthy();
      expect(getByText('Broadcast Absentee Alerts')).toBeTruthy();
    });
  });

  describe('3. Student Role: StudentAttendanceScreen', () => {
    it('renders student smart attendance with AI Doctor and forecast pill', () => {
      const { getByText, getAllByText } = render(<StudentAttendanceScreen />);
      expect(getByText('Smart Attendance')).toBeTruthy();
      expect(getByText('Attendance Doctor (AI Forecaster)')).toBeTruthy();
      expect(getAllByText('Overview')[0]).toBeTruthy();
      expect(getAllByText('Scan QR')[0]).toBeTruthy();
      expect(getByText('GPS Check-in')).toBeTruthy();
    });

    it('renders courses tab and filter options', () => {
      const { getByText } = render(<StudentAttendanceScreen />);
      const coursesTab = getByText('Courses');
      fireEvent.press(coursesTab);
      expect(getByText('Course-wise Attendance')).toBeTruthy();
    });
  });

  describe('4. Faculty Role: FacultyClassesScreen', () => {
    it('renders faculty active and past attendance sessions with deep monitoring link', () => {
      const { getByText, getAllByText } = render(<FacultyClassesScreen />);
      expect(getByText('My Classes')).toBeTruthy();
      expect(getByText('Take Attendance')).toBeTruthy();
      expect(getByText('Active Sessions')).toBeTruthy();
      expect(getAllByText('Database Systems')[0]).toBeTruthy();
      expect(getByText(/TAP TO MONITOR LIVE/)).toBeTruthy();
    });
  });

  describe('5. Live Session Monitoring: LiveAttendanceScreen', () => {
    it('renders live attendance telemetry with real-time roster and stats', async () => {
      const { getByText, getAllByText } = render(<LiveAttendanceScreen />);
      await waitFor(() => {
        expect(getByText('Database Systems')).toBeTruthy();
        expect(getAllByText('Present')[0]).toBeTruthy();
        expect(getByText('Aarav Sharma')).toBeTruthy();
      });
    });
  });
});
