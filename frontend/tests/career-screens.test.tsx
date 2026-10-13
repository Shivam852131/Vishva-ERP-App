import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

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
  useLocalSearchParams: () => ({ id: 'session-1', attemptId: 'attempt-1' }),
}));

jest.mock('@/src/providers/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Test Student', role: 'student', department: 'CSE' },
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

const { api } = require('@/src/api');

// Every screen is driven by useFetch, so a null payload exercises the
// loading -> empty path that a brand-new student actually hits.
const SCREENS: [string, () => any][] = [
  ['live-classes', () => require('@/app/live-classes').default],
  ['live-class', () => require('@/app/live-class').default],
  ['placement', () => require('@/app/placement').default],
  ['skill-assessment', () => require('@/app/skill-assessment').default],
  ['assessment-attempt', () => require('@/app/assessment-attempt').default],
  ['mentorship', () => require('@/app/mentorship').default],
  ['skill-profile', () => require('@/app/skill-profile').default],
  ['career-dashboard', () => require('@/app/career-dashboard').default],
];

describe('career feature screens render', () => {
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
