import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import LiveClassRoom from '@/app/live-class';
import { api } from '@/src/api';
import { clearFetchCache } from '@/src/hooks/useFetch';
import { meetingWebUrl } from '@/src/jitsi/meeting';

// The in-app meeting surface. Rendered as a stub carrying the URI under test,
// so these tests can assert *which room* is being shown inside the app.
jest.mock('react-native-webview', () => {
  const ReactShim = require('react');
  const { View } = require('react-native');
  return {
    WebView: (props: any) =>
      ReactShim.createElement(View, {
        testID: 'in-app-meeting-webview',
        accessibilityLabel: props?.source?.uri,
      }),
  };
});

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
const GOOGLE_URL = 'https://meet.google.com/abc-defg-hij';

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

function mockApiFor(session: any, meetingOverrides: Record<string, unknown> = {}) {
  (api as jest.Mock).mockImplementation((path: string) => {
    if (path.endsWith('/meeting')) {
      return Promise.resolve({
        ...MEETING_INFO,
        is_host: session.is_host,
        ...meetingOverrides,
      });
    }
    if (path.endsWith('/messages')) return Promise.resolve([]);
    if (path.endsWith('/start') || path.endsWith('/join')) return Promise.resolve({});
    return Promise.resolve(session);
  });
}

/** The room currently rendered *inside* the app, or null when none is open. */
function openRoomUrl(tree: any): string | null {
  const view = tree.queryByTestId('in-app-meeting-webview');
  return view ? view.props.accessibilityLabel : null;
}

/**
 * A consent dialog the app must never skip: reached only from a visible
 * button, never as a silent redirect out of the app.
 */
function findConsentCall(title = 'Open meeting'): any[] | undefined {
  return (Alert.alert as unknown as jest.Mock).mock.calls.find(c => c[0] === title);
}

function confirmConsent(title = 'Open meeting') {
  const call = findConsentCall(title);
  expect(call).toBeTruthy();
  const confirm = (call![2] as any[]).find(b => b.text === 'Open');
  expect(confirm).toBeTruthy();
  confirm.onPress();
}

describe('live-class in-app meeting flow (video stays inside the app)', () => {
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

  it('teacher Start class shows the room in-app and never leaves the app', async () => {
    const tree = render(<LiveClassRoom />);
    await waitFor(() => expect(tree.getByText('Start class')).toBeTruthy());

    fireEvent.press(tree.getByText('Start class'));

    // The server-provided room descriptor is fetched first…
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/live-classes/session-1/meeting'),
    );

    // …then the room renders on the in-app surface with the exact URL the
    // server gave us. No browser, no consent dialog: nothing left the app.
    await waitFor(() => expect(openRoomUrl(tree)).toBe(ROOM_URL));
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(findConsentCall()).toBeUndefined();

    tree.unmount();
  });

  it('the in-app meeting always has an explicit way out', async () => {
    const tree = render(<LiveClassRoom />);
    await waitFor(() => expect(tree.getByText('Start class')).toBeTruthy());
    fireEvent.press(tree.getByText('Start class'));
    await waitFor(() => expect(openRoomUrl(tree)).toBe(ROOM_URL));

    // iOS has no hardware back button and the WebView has no browser chrome,
    // so the Leave control is the guaranteed escape from the meeting.
    const leave = tree.getByLabelText('Leave meeting');
    fireEvent.press(leave);

    await waitFor(() => expect(openRoomUrl(tree)).toBeNull());
    // Leaving never counts as consent to open a browser.
    expect(Linking.openURL).not.toHaveBeenCalled();

    tree.unmount();
  });

  it('student Join class uses the same in-app surface', async () => {
    mockApiFor(STUDENT_SESSION);
    const tree = render(<LiveClassRoom />);
    await waitFor(() => expect(tree.getByText('Join class')).toBeTruthy());

    fireEvent.press(tree.getByText('Join class'));

    await waitFor(() => expect(openRoomUrl(tree)).toBe(ROOM_URL));
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(api).toHaveBeenCalledWith('/live-classes/session-1/meeting');

    tree.unmount();
  });

  it('carries the session JWT into the in-app room', async () => {
    mockApiFor(HOST_SESSION, { token: 'tok-123' });
    const tree = render(<LiveClassRoom />);
    await waitFor(() => expect(tree.getByText('Start class')).toBeTruthy());

    fireEvent.press(tree.getByText('Start class'));

    await waitFor(() =>
      expect(openRoomUrl(tree)).toBe(`${ROOM_URL}?jwt=tok-123`),
    );
    expect(Linking.openURL).not.toHaveBeenCalled();

    tree.unmount();
  });

  it('never embeds a Google room_url — it asks first', async () => {
    mockApiFor(HOST_SESSION, { room_url: GOOGLE_URL });
    const tree = render(<LiveClassRoom />);
    await waitFor(() => expect(tree.getByText('Start class')).toBeTruthy());

    fireEvent.press(tree.getByText('Start class'));

    // Google Meet can never be embedded, so this is the one branch that does
    // hand off — and only behind an explicit confirmation.
    await waitFor(() => expect(findConsentCall('Open meeting')).toBeTruthy());
    expect(openRoomUrl(tree)).toBeNull();
    expect(Linking.openURL).not.toHaveBeenCalled();

    confirmConsent('Open meeting');
    expect(Linking.openURL).toHaveBeenCalledWith(GOOGLE_URL);

    tree.unmount();
  });

  it('keeps an existing Google Meet link a consented browser open', async () => {
    const session = { ...HOST_SESSION, meeting_url: GOOGLE_URL };
    mockApiFor(session);
    const tree = render(<LiveClassRoom />);
    await waitFor(() => expect(tree.getByText('Google Meet')).toBeTruthy());

    fireEvent.press(tree.getByText('Google Meet'));

    await waitFor(() => expect(findConsentCall('Open Google Meet')).toBeTruthy());
    expect(Linking.openURL).not.toHaveBeenCalled();

    confirmConsent('Open Google Meet');
    expect(Linking.openURL).toHaveBeenCalledWith(GOOGLE_URL);

    tree.unmount();
  });
});

describe('meetingWebUrl (what the in-app page is loaded with)', () => {
  it('returns the bare room when there is no token', () => {
    expect(meetingWebUrl({ room_url: ROOM_URL, token: null })).toBe(ROOM_URL);
    expect(meetingWebUrl({ room_url: ROOM_URL, token: '   ' })).toBe(ROOM_URL);
  });

  it('appends the JWT as a query param', () => {
    expect(meetingWebUrl({ room_url: ROOM_URL, token: 'a.b-c_d' })).toBe(
      `${ROOM_URL}?jwt=a.b-c_d`,
    );
  });

  it('joins with & when the room already has a query', () => {
    expect(meetingWebUrl({ room_url: `${ROOM_URL}?foo=1`, token: 't' })).toBe(
      `${ROOM_URL}?foo=1&jwt=t`,
    );
  });

  it('never duplicates a JWT the link already carries', () => {
    expect(meetingWebUrl({ room_url: `${ROOM_URL}?jwt=old`, token: 'new' })).toBe(
      `${ROOM_URL}?jwt=old`,
    );
    expect(
      meetingWebUrl({ room_url: `${ROOM_URL}?a=1&jwt=old`, token: 'new' }),
    ).toBe(`${ROOM_URL}?a=1&jwt=old`);
  });

  it('URL-encodes the token', () => {
    expect(meetingWebUrl({ room_url: ROOM_URL, token: 'a+b/c=' })).toBe(
      `${ROOM_URL}?jwt=a%2Bb%2Fc%3D`,
    );
  });
});
