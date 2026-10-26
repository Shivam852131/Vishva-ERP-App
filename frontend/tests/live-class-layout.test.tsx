import React from 'react';
import { StyleSheet } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import LiveClassRoom from '@/app/live-class';
import { api } from '@/src/api';
import { clearFetchCache } from '@/src/hooks/useFetch';

// Native-only TurboModule (`RNCWebViewModule`) resolved at import time; the
// jest environment has no native binary for it. `app/live-class` now imports
// the in-app meeting surface, which pulls this package in at module scope.
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: View };
});

// Regression test for the room header clipping its second button behind the
// tab bar.
//
// The "Create Google Meet link" button lives in styles.meetRow and is given
// flex:1 so it fills the row. flex:1 is shorthand for flexBasis:0 — inside a
// column container that zeroes the child's hypothetical height, and since an
// auto-height parent has no free space for flexGrow to claim, the row collapses
// to just its paddingBottom (12dp). The button keeps its natural height, so it
// overflows and gets painted over by the tab bar that follows it.
//
// Declaring flexDirection:'row' moves flex:1 onto the horizontal axis, so the
// row's height is the button's real height again.

jest.mock('@/src/api', () => ({
  api: jest.fn(),
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
  useLocalSearchParams: () => ({ id: 'session-1' }),
}));

jest.mock('@/src/providers/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Host User', role: 'teacher', department: 'CSE', email: 'h@example.com' },
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

// The exact state from the bug report: host, class not started yet.
const SCHEDULED_HOST_SESSION = {
  id: 'session-1',
  title: 'Python',
  status: 'scheduled',
  is_host: true,
  scheduled_at: '2026-10-22T18:57:03.000Z',
  meeting_url: null,
  questions: [],
  polls: [],
  participants: [],
};

describe('live-class room layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearFetchCache();
    (api as jest.Mock).mockImplementation((path: string) =>
      Promise.resolve(path.endsWith('/messages') ? [] : SCHEDULED_HOST_SESSION),
    );
  });

  it('renders both host buttons once the session loads', async () => {
    const tree = render(<LiveClassRoom />);

    await waitFor(() => expect(tree.getByText('Start class')).toBeTruthy());
    expect(tree.getByText('Create Google Meet link')).toBeTruthy();

    tree.unmount();
  });

  it('keeps the Meet row a horizontal flex container so its button cannot collapse', async () => {
    const tree = render(<LiveClassRoom />);

    await waitFor(() => expect(tree.getByTestId('meet-row')).toBeTruthy());

    const rowStyle = StyleSheet.flatten(tree.getByTestId('meet-row').props.style);
    expect(rowStyle.flexDirection).toBe('row');

    tree.unmount();
  });

  it('keeps the banner, action bar, Meet row and tab bar as fixed siblings above the panel', async () => {
    const tree = render(<LiveClassRoom />);

    await waitFor(() => expect(tree.getByTestId('meet-row')).toBeTruthy());

    // The tab bar must stay in flow after the Meet row rather than overlapping it.
    expect(tree.getByText('Chat')).toBeTruthy();
    expect(tree.getByText('People')).toBeTruthy();
    // The chat panel still owns the remaining height.
    expect(tree.getByPlaceholderText('Type a message...')).toBeTruthy();

    tree.unmount();
  });
});
