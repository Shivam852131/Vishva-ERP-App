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

jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: View };
});

jest.mock('react-native-qrcode-svg', () => {
  const { View } = require('react-native');
  return function QRCode() { return View; };
});

jest.mock('react-native-fs', () => ({
  default: {
    readFile: jest.fn(() => Promise.resolve('')),
    writeFile: jest.fn(() => Promise.resolve()),
    appendFile: jest.fn(() => Promise.resolve()),
    moveFile: jest.fn(() => Promise.resolve()),
    readDir: jest.fn(() => Promise.resolve([])),
    unlink: jest.fn(() => Promise.resolve()),
    DocumentDirectoryPath: '/tmp/docs',
    DownloadDirectoryPath: '/tmp/downloads',
  },
  readFile: jest.fn(() => Promise.resolve('')),
  writeFile: jest.fn(() => Promise.resolve()),
  DocumentDirectoryPath: '/tmp/docs',
}));

jest.mock('@/src/native/image-picker', () => ({
  launchCameraAsync: jest.fn(() => Promise.resolve({ didCancel: true, assets: [] })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ didCancel: true, assets: [] })),
}));

// Native TurboModule — not registered in the jest environment, so importing
// the real package throws 'RNDocumentPicker could not be found'.
jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(() => Promise.resolve([])),
  pickSingle: jest.fn(() => Promise.resolve({
    uri: '', name: 'file.xlsx', fileCopyUri: null,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 0,
  })),
  isCancel: jest.fn(() => false),
  types: {
    allFiles: '*/*',
    csv: 'text/csv',
    pdf: 'application/pdf',
    plainText: 'text/plain',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
}));

jest.mock('@/src/localshare/hooks/useLocalShare', () => ({
  useLocalShare: () => ({
    session: null, sessions: [], loading: false, error: null,
    createSession: jest.fn(), fetchSessions: jest.fn(), fetchSession: jest.fn(),
    joinSession: jest.fn(), endSession: jest.fn(), deleteSession: jest.fn(),
    logDownload: jest.fn(), submitFeedback: jest.fn(),
  }),
  useLocalShareRTC: () => ({
    isConnected: false, connectionState: 'new', error: null, peerDisconnected: false,
    transfers: {}, receivedFiles: [], retryCount: 0,
    initAsTeacher: jest.fn(), initAsStudent: jest.fn(),
    sendData: jest.fn(), sendFiles: jest.fn(), disconnect: jest.fn(),
    cleanupLocalFiles: jest.fn(), hasActiveTransfers: jest.fn(() => false),
    WebViewBridge: () => null,
  }),
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
  ['exam-prep/dashboard', () => require('@/app/exam-prep-dashboard').default],
  ['exam-prep/practice', () => require('@/app/exam-prep-practice').default],
  ['exam-prep/question-bank', () => require('@/app/exam-prep-question-bank').default],
  ['exam-prep/question-manager', () => require('@/app/exam-prep-question-manager').default],
  ['exam-prep/quiz-builder', () => require('@/app/exam-prep-quiz-builder').default],
  ['exam-prep/attempt', () => require('@/app/exam-prep-attempt').default],
  ['exam-prep/bookmarks', () => require('@/app/exam-prep-bookmarks').default],
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
  ['faculty-attendance', () => require('@/app/faculty-attendance').default],
  ['faculty-attendance-course', () => require('@/app/faculty-attendance-course').default],
  ['skill-assessment', () => require('@/app/skill-assessment').default],
  ['assessment-attempt', () => require('@/app/assessment-attempt').default],
  ['mentorship', () => require('@/app/mentorship').default],
  ['skill-profile', () => require('@/app/skill-profile').default],
  ['career-dashboard', () => require('@/app/career-dashboard').default],
  ['localshare-home', () => require('@/app/localshare-home').default],
  ['localshare-create', () => require('@/app/localshare-create').default],
  ['localshare-active', () => require('@/app/localshare-active').default],
  ['localshare-join', () => require('@/app/localshare-join').default],
  ['localshare-transfer', () => require('@/app/localshare-transfer').default],
  ['localshare-history', () => require('@/app/localshare-history').default],
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
