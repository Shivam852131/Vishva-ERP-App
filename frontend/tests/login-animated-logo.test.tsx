import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Focused regression test for the animated-logo integration in app/login.tsx.
// Mirrors the mocks from tests/all-screens.test.tsx (which is too broad/slow to
// gate a single-screen change) but renders only the login screen.

jest.mock('@/src/api', () => ({
  api: jest.fn(() => Promise.resolve(null)),
  apiUrl: (p: string) => p,
  getToken: jest.fn(() => Promise.resolve(null)),
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
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/src/providers/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: View };
});
jest.mock('react-native-qrcode-svg', () => {
  const { View } = require('react-native');
  return function QRCode() {
    return View;
  };
});

import { LOGIN, REGISTER } from '@/constants/testIds';

describe('login screen with AnimatedViLogo', () => {
  it('mounts without crashing and shows the brand name', async () => {
    const Login = require('@/app/login').default;
    const tree = render(<Login />);
    expect(tree.toJSON()).toBeTruthy();
    expect(tree.getByText('Vishva ERP')).toBeTruthy();
    tree.unmount();
  });

  it('keeps form interactions working (email typing + tab switch)', () => {
    const Login = require('@/app/login').default;
    const tree = render(<Login />);

    // Typing in the email field still updates state.
    fireEvent.changeText(tree.getByTestId(LOGIN.emailInput), 'student@campus.edu');
    expect(tree.getByTestId(LOGIN.emailInput).props.value).toBe('student@campus.edu');

    // Switching to the Register tab still reveals the extra fields.
    // Note the counterintuitive IDs: the Sign In tab wears LOGIN.registerLink,
    // so the Register tab is REGISTER.loginLink.
    fireEvent.press(tree.getByTestId(REGISTER.loginLink));
    expect(tree.getByText('Full Name')).toBeTruthy();

    tree.unmount();
  });
});

describe('phone-login screen with AnimatedViLogo', () => {
  it('mounts without crashing and keeps the phone input interactive', () => {
    const PhoneLogin = require('@/app/phone-login').default;
    const tree = render(<PhoneLogin />);
    expect(tree.toJSON()).toBeTruthy();

    // The phone field still accepts input on step one.
    const phoneInput = tree.getByPlaceholderText('Enter 10-digit number');
    fireEvent.changeText(phoneInput, '9876543210');
    expect(phoneInput.props.value).toBe('9876543210');

    tree.unmount();
  });
});
