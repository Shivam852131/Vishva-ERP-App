import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockVisitors = [
  {
    id: 'v-1',
    name: 'Dr. Ramesh Gupta',
    purpose: 'Guest Lecture',
    who: 'Dept of Computer Science',
    type: 'guest',
    status: 'in_campus',
    inTime: '10:30 AM',
    outTime: '',
  },
  {
    id: 'v-2',
    name: 'Sunita Sharma',
    purpose: 'Fee Query',
    who: 'Accounts Dept',
    type: 'parent',
    status: 'pending_approval',
    expectedTime: '02:00 PM',
  },
];

jest.mock('@/src/hooks/useFetch', () => ({
  useFetch: jest.fn((url: string) => {
    if (url === '/visitors') {
      return { data: mockVisitors, loading: false, error: null, refresh: jest.fn() };
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
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/src/providers/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      name: 'College Admin',
      role: 'college_admin',
    },
    loading: false,
  }),
}));

import VisitorManagement from '@/app/visitor';
import { TabSelector } from '@/src/ui';

describe('Visitor Management Screen', () => {
  it('renders Visitor Management screen without "map of undefined" error', () => {
    const { getByText } = render(<VisitorManagement />);
    expect(getByText('Visitor Management')).toBeTruthy();
    expect(getByText('Visitor Log')).toBeTruthy();
    expect(getByText('Approvals')).toBeTruthy();
    expect(getByText('Register')).toBeTruthy();
  });

  it('renders visitor cards from active log', () => {
    const { getByText } = render(<VisitorManagement />);
    expect(getByText('Dr. Ramesh Gupta')).toBeTruthy();
    expect(getByText('In Campus')).toBeTruthy();
  });

  it('switches to Approvals tab and displays pending visitors', () => {
    const { getByText, queryByText } = render(<VisitorManagement />);
    const approvalsTab = getByText('Approvals');
    fireEvent.press(approvalsTab);

    expect(getByText('Sunita Sharma')).toBeTruthy();
    expect(getByText('Pending Approval')).toBeTruthy();
    expect(getByText('Approve Pass')).toBeTruthy();
  });

  it('switches to Register tab and shows registration form', () => {
    const { getByText } = render(<VisitorManagement />);
    const registerTab = getByText('Register');
    fireEvent.press(registerTab);

    expect(getByText('Register New Visitor')).toBeTruthy();
    expect(getByText('Visitor Full Name *')).toBeTruthy();
    expect(getByText('Register & Issue Pass')).toBeTruthy();
  });

  it('handles TabSelector when called with options and selected props instead of tabs', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <TabSelector
        options={[
          { key: 't1', label: 'Tab One', badge: 3 },
          { key: 't2', label: 'Tab Two' },
        ]}
        selected="t1"
        onSelect={onSelect}
      />
    );

    expect(getByText('Tab One')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
    expect(getByText('Tab Two')).toBeTruthy();

    fireEvent.press(getByText('Tab Two'));
    expect(onSelect).toHaveBeenCalledWith('t2');
  });

  it('handles TabSelector with undefined props without throwing error', () => {
    const { toJSON } = render(<TabSelector />);
    expect(toJSON()).toBeTruthy();
  });
});
