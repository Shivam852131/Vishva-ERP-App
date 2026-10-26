import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

// The null-payload path all-screens.test.tsx never reaches.
//
// That suite asserts toJSON() truthy straight after render and then unmounts,
// so it can pass before useFetch's response has landed. These screens used to
// throw on the real payload - `(notifications as any[]).filter` on
// dashboard.tsx, `users.length` on reports.tsx and UserManagement.tsx - so
// this keeps the screen mounted while the mocked api resolves `null`.

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

jest.mock('@/src/providers/AuthContext', () => {
  const auth = {
    user: {
      id: 'u1',
      name: 'Test User',
      role: 'college_admin',
      department: 'CSE',
      email: 't@example.com',
      year: 3,
      student_id: 'S123',
    },
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
  };
  return {
    useAuth: () => auth,
    AuthProvider: ({ children }: any) => children,
  };
});

const SCREENS: [string, () => any][] = [
  ['college_admin/dashboard', () => require('@/app/(college_admin)/dashboard').default],
  ['college_admin/reports', () => require('@/app/(college_admin)/reports').default],
  ['college_admin/users', () => require('@/app/(college_admin)/users').default],
];

describe('a null API payload lands while the screen is mounted', () => {
  it.each(SCREENS)('%s renders it without crashing', async (_name, load) => {
    const Screen = load();
    const tree = render(<Screen />);
    await waitFor(() => expect(tree.toJSON()).toBeTruthy());

    // Flush the mocked api's resolved `null` so useFetch stores it and
    // re-renders while this screen is still alive - the state all-screens
    // unmounts before reaching.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(tree.toJSON()).toBeTruthy();
    tree.unmount();
  });
});
