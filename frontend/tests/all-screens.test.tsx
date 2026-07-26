import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// Mirrors tests/career-screens.test.tsx, widened to every screen in app/.
// A null API payload exercises the loading -> empty path a brand-new user hits,
// which is where unguarded `data.field` access crashes.

jest.mock('@/src/api', () => ({
  api: jest.fn(() => Promise.resolve(null)),
  apiUrl: (p: string) => p,
  getToken: jest.fn(() => Promise.resolve('t')),
  getUser: jest.fn(() => Promise.resolve(null)),
  setAuth: jest.fn(),
  clearAuth: jest.fn(),
  setUnauthorizedHandler: jest.fn(),
  BASE_URL: '',
}));

jest.mock('@/src/realtime/socket', () => ({
  connectRealtime: jest.fn(() => Promise.resolve(null)),
  subscribeRealtime: jest.fn(() => () => {}),
  disconnectRealtime: jest.fn(),
  reconnectRealtime: jest.fn(),
}));

jest.mock('@/src/navigation/router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'session-1', attemptId: 'attempt-1', sid: 's1' }),
}));

jest.mock('@/src/providers/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      name: 'Test User',
      role: 'student',
      department: 'CSE',
      email: 't@example.com',
      year: 3,
      student_id: 'S123',
    },
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

// Native-only module with no JS fallback; absent in the jest environment.
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(() => Promise.resolve('file:///tmp/shot.png')),
}));

const { api } = require('@/src/api');

// Every screen reachable from App.tsx. Camera/scanner screens are covered too —
// their native modules resolve through the RN jest preset's mocks.
const SCREENS: [string, () => any][] = [
  ['index', () => require('@/app/index').default],
  ['landing', () => require('@/app/landing').default],
  ['login', () => require('@/app/login').default],
  ['phone-login', () => require('@/app/phone-login').default],
  ['student/dashboard', () => require('@/app/(student)/dashboard').default],
  ['student/timetable', () => require('@/app/(student)/timetable').default],
  ['student/assignments', () => require('@/app/(student)/assignments').default],
  ['student/ai', () => require('@/app/(student)/ai').default],
  ['student/profile', () => require('@/app/(student)/profile').default],
  ['student/fees', () => require('@/app/(student)/fees').default],
  ['faculty/dashboard', () => require('@/app/(faculty)/dashboard').default],
  ['faculty/classes', () => require('@/app/(faculty)/classes').default],
  ['faculty/assignments', () => require('@/app/(faculty)/assignments').default],
  ['faculty/ai', () => require('@/app/(faculty)/ai').default],
  ['faculty/profile', () => require('@/app/(faculty)/profile').default],
  ['faculty/exam-generator', () => require('@/app/(faculty)/exam-generator').default],
  ['faculty/question-paper', () => require('@/app/(faculty)/question-paper').default],
  ['parent/dashboard', () => require('@/app/(parent)/dashboard').default],
  ['parent/attendance', () => require('@/app/(parent)/attendance').default],
  ['parent/fees', () => require('@/app/(parent)/fees').default],
  ['parent/ai', () => require('@/app/(parent)/ai').default],
  ['parent/profile', () => require('@/app/(parent)/profile').default],
  ['college_admin/dashboard', () => require('@/app/(college_admin)/dashboard').default],
  ['college_admin/users', () => require('@/app/(college_admin)/users').default],
  ['college_admin/attendance', () => require('@/app/(college_admin)/attendance').default],
  ['college_admin/academics', () => require('@/app/(college_admin)/academics').default],
  ['college_admin/reports', () => require('@/app/(college_admin)/reports').default],
  ['college_admin/profile', () => require('@/app/(college_admin)/profile').default],
  ['college_admin/payments', () => require('@/app/(college_admin)/payments').default],
  ['college_admin/subscription', () => require('@/app/(college_admin)/subscription').default],
  ['super_admin/dashboard', () => require('@/app/(super_admin)/dashboard').default],
  ['super_admin/colleges', () => require('@/app/(super_admin)/colleges').default],
  ['super_admin/users', () => require('@/app/(super_admin)/users').default],
  ['super_admin/reports', () => require('@/app/(super_admin)/reports').default],
  ['super_admin/profile', () => require('@/app/(super_admin)/profile').default],
  ['analytics', () => require('@/app/analytics').default],
  ['attendance', () => require('@/app/attendance').default],
  ['attendance-live', () => require('@/app/attendance-live').default],
  ['chat', () => require('@/app/chat').default],
  ['events', () => require('@/app/events').default],
  ['exams', () => require('@/app/exams').default],
  ['fees', () => require('@/app/fees').default],
  ['grievances', () => require('@/app/grievances').default],
  ['hostel', () => require('@/app/hostel').default],
  ['id-card', () => require('@/app/id-card').default],
  ['library', () => require('@/app/library').default],
  ['notes', () => require('@/app/notes').default],
  ['notifications', () => require('@/app/notifications').default],
  ['placement', () => require('@/app/placement').default],
  ['results', () => require('@/app/results').default],
  ['scan', () => require('@/app/scan').default],
  ['selfie', () => require('@/app/selfie').default],
  ['session', () => require('@/app/session').default],
  ['start-session', () => require('@/app/start-session').default],
  ['transport', () => require('@/app/transport').default],
  ['visitor', () => require('@/app/visitor').default],
  ['complaints', () => require('@/app/complaints').default],
  ['assets', () => require('@/app/assets').default],
  ['push-notifications', () => require('@/app/push-notifications').default],
  ['email', () => require('@/app/email').default],
  ['whatsapp', () => require('@/app/whatsapp').default],
  ['assignment-checker', () => require('@/app/assignment-checker').default],
  ['report-card', () => require('@/app/report-card').default],
  ['career-advisor', () => require('@/app/career-advisor').default],
  ['resume-builder', () => require('@/app/resume-builder').default],
  ['interview-practice', () => require('@/app/interview-practice').default],
  ['study-planner', () => require('@/app/study-planner').default],
  ['bus-tracking', () => require('@/app/bus-tracking').default],
  ['face-enroll', () => require('@/app/face-enroll').default],
  ['live-classes', () => require('@/app/live-classes').default],
  ['live-class', () => require('@/app/live-class').default],
  ['skill-assessment', () => require('@/app/skill-assessment').default],
  ['assessment-attempt', () => require('@/app/assessment-attempt').default],
  ['mentorship', () => require('@/app/mentorship').default],
  ['skill-profile', () => require('@/app/skill-profile').default],
  ['career-dashboard', () => require('@/app/career-dashboard').default],
];

describe('every screen mounts on an empty API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api as jest.Mock).mockResolvedValue(null);
  });

  it.each(SCREENS)('%s mounts without crashing', async (_name, load) => {
    const Screen = load();
    const tree = render(<Screen />);
    await waitFor(() => expect(tree.toJSON()).toBeTruthy());
    tree.unmount();
  });
});

describe('every screen mounts when the API errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api as jest.Mock).mockRejectedValue(new Error('network down'));
  });

  it.each(SCREENS)('%s survives a failed fetch', async (_name, load) => {
    const Screen = load();
    const tree = render(<Screen />);
    await waitFor(() => expect(tree.toJSON()).toBeTruthy());
    tree.unmount();
  });
});
