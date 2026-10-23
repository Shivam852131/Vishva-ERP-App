import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import LiveClassRoom from '@/app/live-class';
import { api } from '@/src/api';
import { clearFetchCache } from '@/src/hooks/useFetch';

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

const ROOM_URL = 'https://meet.jit.si/vishva-erp-live-class-session-1';

const HOST_SESSION = {
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

const STUDENT_SESSION = { ...HOST_SESSION, is_host: false };

const MEETING_INFO = {
  session_id: 'session-1',
  title: 'Python',
  status: 'scheduled',
  room_url: ROOM_URL,
  meeting_url: null,
  meeting_provider: null,
  display_name: 'Host User',
  email: 'h@example.com',
  role: 'teacher',
  is_host: true,
  allow_chat: true,
  allow_questions: true,
  token: null,
};

function mockApiFor(session: any) {
  (api as jest.Mock).mockImplementation((path: string) => {
    if (path.endsWith('/meeting')) return Promise.resolve({ ...MEETING_INFO, is_host: session.is_host });
    if (path.endsWith('/messages')) return Promise.resolve([]);
    if (path.endsWith('/start') || path.endsWith('/join')) return Promise.resolve({});
    return Promise.resolve(session);
  });
}

/**
 * The "Open meeting" consent dialog shown when the native Jitsi SDK is not part
 * of this build (Jest resolves no SDK, same as Metro resolving the stub).
 */
function findConsentCall(): any[] | undefined {
  return (Alert.alert as unknown as jest.Mock).mock.calls.find(c => c[0] === 'Open meeting');
}

describe('live-class in-app meeting flow (no silent browser redirect)', () => {
  let alertSpy: jest.SpyInstance;
  let openUrlSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    clearFetchCache();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockImplementation(() => Promise.resolve() as any);
    mockApiFor(HOST_SESSION);
  });

  afterEach(() => {
    alertSpy?.mockRestore();
    openUrlSpy?.mockRestore();
  });

  it('teacher Start class reaches a consent dialog and never redirects silently', async () => {
    const tree = render(<LiveClassRoom />);
    await waitFor(() => expect(tree.getByText('Start class')).toBeTruthy());

    fireEvent.press(tree.getByText('Start class'));

    // The server-provided in-app room descriptor is fetched first…
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/live-classes/session-1/meeting'),
    );

    // …then a consent dialog (no native SDK in this build) — not Chrome.
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Open meeting',
        expect.any(String),
        expect.any(Array),
      ),
    );
    expect(Linking.openURL).not.toHaveBeenCalled();

    tree.unmount();
  });

  it('opens the Jitsi room in the browser only after the user explicitly consents', async () => {
    const tree = render(<LiveClassRoom />);
    await waitFor(() => expect(tree.getByText('Start class')).toBeTruthy());

    fireEvent.press(tree.getByText('Start class'));
    await waitFor(() => expect(findConsentCall()).toBeTruthy());

    // Still no browser open before consent.
    expect(Linking.openURL).not.toHaveBeenCalled();

    // Press "Open" on the consent dialog → the exact in-app Jitsi room opens.
    const buttons = findConsentCall()![2] as any[];
    const confirm = buttons.find(b => b.text === 'Open');
    expect(confirm).toBeTruthy();
    confirm.onPress();

    expect(Linking.openURL).toHaveBeenCalledWith(ROOM_URL);

    tree.unmount();
  });

  it('student Join class uses the same consented in-app flow', async () => {
    mockApiFor(STUDENT_SESSION);
    const tree = render(<LiveClassRoom />);
    await waitFor(() => expect(tree.getByText('Join class')).toBeTruthy());

    fireEvent.press(tree.getByText('Join class'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Open meeting',
        expect.any(String),
        expect.any(Array),
      ),
    );
    // No silent redirect for students either.
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(api).toHaveBeenCalledWith('/live-classes/session-1/meeting');

    tree.unmount();
  });
});
