import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import FacultyAttendanceCourse from '@/app/faculty-attendance-course';
import { api } from '@/src/api';

// Regression coverage for attendance correction: a mark can only change after
// a mandatory reason and an explicit confirmation, the optimistic guards are
// carried to the server, and the immutable audit trail is visible beforehand.

const mockApi = api as jest.MockedFunction<typeof api>;

const mockCourse = {
  threshold: 75,
  period: { startDate: '2026-10-01', endDate: '2026-10-31' },
  course: { id: 'c1', name: 'Database Systems', code: 'CS301', department: 'CSE', semester: '5' },
  summary: {
    present: 3, late: 1, absent: 2, classes_marked: 6, sessions: 6,
    enrolled: 2, marked: 2, defaulters: 1, percentage: 66,
  },
  students: [
    {
      id: 's1',
      name: 'Asha',
      student_code: 'STU01',
      enrolled: true,
      present: 1,
      late: 0,
      absent: 1,
      total: 2,
      percentage: 50,
      status: 'critical',
      shortfall_classes: 2,
      history: { '2026-10-20': 'absent', '2026-10-22': 'present' },
    },
  ],
  sessions: [],
};

const mockAudit = {
  items: [
    {
      id: 'a1',
      previous_status: 'present',
      new_status: 'absent',
      reason: 'Left early without notice',
      actor_name: 'Dr. Rao',
      created_at: '2026-10-21T09:00:00.000Z',
    },
  ],
  total: 1,
  current_status: 'absent',
  original_status: 'present',
};

jest.mock('@/src/navigation/router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'c1' }),
}));

jest.mock('@/src/api', () => ({ api: jest.fn() }));

jest.mock('@/src/hooks/useFetch', () => ({
  useFetch: jest.fn((url: string | null) => {
    if (url && url.startsWith('/attendance/records/audit')) {
      return { data: mockAudit, loading: false, error: null, refresh: jest.fn(), setData: jest.fn() };
    }
    if (url === '/attendance/faculty/course/c1') {
      return { data: mockCourse, loading: false, error: null, refresh: jest.fn(), setData: jest.fn() };
    }
    return { data: undefined, loading: false, error: null, refresh: jest.fn(), setData: jest.fn() };
  }),
}));

jest.mock('@/src/providers/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'f1', name: 'Dr. Rao', role: 'faculty' }, loading: false }),
}));

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockApi.mockResolvedValue({ ok: true } as any);
});

afterEach(() => {
  alertSpy?.mockRestore();
});

function saveDisabled(tree: ReturnType<typeof render>) {
  return !!tree.getByTestId('correction-save').props.accessibilityState?.disabled;
}

async function openSheet(tree: ReturnType<typeof render>) {
  const dot = await waitFor(() => tree.getByTestId('course-dot-s1-2026-10-20'));
  fireEvent.press(dot);
  await waitFor(() => expect(tree.getByTestId('correction-save')).toBeTruthy());
}

function pickStatus(tree: ReturnType<typeof render>, key: string) {
  fireEvent.press(tree.getByTestId(`correction-status-${key}`));
}

function confirmCall(): any[] | undefined {
  return (Alert.alert as unknown as jest.Mock).mock.calls.find((c) => c[0] === 'Correct attendance?');
}

describe('attendance correction dialog', () => {
  it('shows the audit trail and keeps Save disabled without a real change', async () => {
    const tree = render(<FacultyAttendanceCourse />);
    await openSheet(tree);

    // The immutable trail of this mark is visible before editing it.
    expect(tree.getByTestId('correction-trail')).toBeTruthy();
    expect(tree.getByText(/Left early without notice/)).toBeTruthy();

    // Status is preselected to the current mark → nothing changed yet.
    expect(saveDisabled(tree)).toBe(true);

    // A reason shorter than the 5-character minimum keeps it disabled.
    fireEvent.changeText(tree.getByTestId('correction-reason'), 'ok');
    expect(saveDisabled(tree)).toBe(true);

    // A valid reason alone is not enough: the status still has to change.
    fireEvent.changeText(tree.getByTestId('correction-reason'), 'Scanner lost the check-in');
    expect(saveDisabled(tree)).toBe(true);

    pickStatus(tree, 'present');
    expect(saveDisabled(tree)).toBe(false);

    // Disabled presses never reach the API (optimistic validation).
    tree.unmount();
    const tree2 = render(<FacultyAttendanceCourse />);
    await openSheet(tree2);
    fireEvent.changeText(tree2.getByTestId('correction-reason'), 'short');
    fireEvent.press(tree2.getByTestId('correction-save'));
    expect(mockApi).not.toHaveBeenCalled();
    tree2.unmount();
  });

  it('asks for confirmation and sends the correction with its guards', async () => {
    const tree = render(<FacultyAttendanceCourse />);
    await openSheet(tree);

    pickStatus(tree, 'present');
    fireEvent.changeText(tree.getByTestId('correction-reason'), 'Scanner lost the check-in');
    fireEvent.press(tree.getByTestId('correction-save'));

    // Nothing leaves the device before the user explicitly confirms.
    expect(mockApi).not.toHaveBeenCalled();
    expect(confirmCall()).toBeTruthy();

    const confirm = (confirmCall()![2] as any[]).find((b) => b.text === 'Correct');
    expect(confirm).toBeTruthy();
    await act(async () => {
      await confirm.onPress();
    });

    expect(mockApi).toHaveBeenCalledWith(
      '/attendance/records/correct',
      expect.objectContaining({ method: 'PATCH' }),
    );
    const body = JSON.parse((mockApi.mock.calls[0][1] as any).body);
    expect(body).toEqual(
      expect.objectContaining({
        courseId: 'c1',
        studentId: 's1',
        date: '2026-10-20',
        status: 'present',
        reason: 'Scanner lost the check-in',
        expected_status: 'absent',
      }),
    );
    expect(Alert.alert).toHaveBeenCalledWith('Attendance corrected', expect.any(String));

    tree.unmount();
  });

  it('surfaces a server rejection and keeps the sheet open', async () => {
    mockApi.mockRejectedValue(
      Object.assign(
        new Error('Attendance for 2026-10-20 is locked. Corrections are allowed for the last 7 days.'),
        { status: 403 },
      ),
    );

    const tree = render(<FacultyAttendanceCourse />);
    await openSheet(tree);

    pickStatus(tree, 'late');
    fireEvent.changeText(tree.getByTestId('correction-reason'), 'Lock window should refuse this');
    fireEvent.press(tree.getByTestId('correction-save'));

    const confirm = (confirmCall()![2] as any[]).find((b) => b.text === 'Correct');
    await act(async () => {
      await confirm.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Correction failed',
      expect.stringContaining('is locked'),
    );
    // The sheet stays open so the faculty member can read the reason and retry.
    expect(tree.getByTestId('correction-save')).toBeTruthy();

    tree.unmount();
  });
});
