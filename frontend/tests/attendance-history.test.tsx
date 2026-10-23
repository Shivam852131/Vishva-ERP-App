import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AttendanceHistory from '@/app/attendance-history';
import { useFetch } from '@/src/hooks/useFetch';
import { downloadFile, openFile } from '@/src/download';

// Regression coverage for the attendance history page: combined filters and
// paging drive server-side queries, the summary cards reflect the server
// summary, and exports carry both the current filters and the auth header.

const mockPush = jest.fn();
const mockUseFetch = useFetch as jest.Mock;
const mockDownloadFile = downloadFile as jest.MockedFunction<typeof downloadFile>;
const mockOpenFile = openFile as jest.MockedFunction<typeof openFile>;

const mockHistory = {
  items: [
    {
      id: 'r1', date: '2026-10-22', status: 'present', method: 'qr',
      student_id: 's1', student_name: 'Asha', student_code: 'STU01',
      course_id: 'c1', course_name: 'Database Systems', course_code: 'CS301',
      corrected: false, corrected_at: null, corrected_by: null,
      correction_reason: null, original_status: null,
    },
    {
      id: 'r2', date: '2026-10-22', status: 'absent', method: 'manual',
      student_id: 's2', student_name: 'Ravi', student_code: 'STU02',
      course_id: 'c1', course_name: 'Database Systems', course_code: 'CS301',
      corrected: true, corrected_at: '2026-10-23T09:00:00.000Z', corrected_by: 'Dr. Rao',
      correction_reason: 'Scanner failed', original_status: 'present',
    },
    {
      id: 'r3', date: '2026-10-21', status: 'late', method: 'qr',
      student_id: 's1', student_name: 'Asha', student_code: 'STU01',
      course_id: 'c2', course_name: 'Operating Systems', course_code: 'CS302',
      corrected: false, corrected_at: null, corrected_by: null,
      correction_reason: null, original_status: null,
    },
  ],
  total: 42,
  page: 1,
  pageSize: 20,
  sort: 'date',
  order: 'desc',
  summary: { total: 42, present: 30, late: 4, absent: 8, corrected: 3, percentage: 81 },
};

const mockCourses = [
  { id: 'c1', name: 'Database Systems', code: 'CS301' },
  { id: 'c2', name: 'Operating Systems', code: 'CS302' },
];

jest.mock('@/src/navigation/router', () => ({
  router: { push: (p: any) => mockPush(p), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: (p: any) => mockPush(p), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/src/hooks/useFetch', () => ({
  useFetch: jest.fn((url: string | null) => {
    if (url && url.includes('/attendance/history')) {
      return { data: mockHistory, loading: false, error: null, refresh: jest.fn(), setData: jest.fn() };
    }
    if (url === '/courses') {
      return { data: mockCourses, loading: false, error: null, refresh: jest.fn(), setData: jest.fn() };
    }
    return { data: undefined, loading: false, error: null, refresh: jest.fn(), setData: jest.fn() };
  }),
}));

jest.mock('@/src/api', () => ({
  api: jest.fn(),
  apiUrl: (p: string) => `http://test/api${p}`,
  getToken: jest.fn(async () => 'test-token'),
}));

jest.mock('@/src/download', () => ({
  downloadFile: jest.fn(async () => ({ path: '/docs/attendance.csv', fileName: 'attendance.csv', mimeType: 'text/csv' })),
  openFile: jest.fn(async () => {}),
}));

jest.mock('@/src/providers/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'f1', name: 'Dr. Rao', role: 'faculty' }, loading: false }),
}));

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockDownloadFile.mockResolvedValue({ path: '/docs/attendance.csv', fileName: 'attendance.csv', mimeType: 'text/csv' });
  mockOpenFile.mockResolvedValue(undefined);
});

afterEach(() => {
  alertSpy?.mockRestore();
});

function fetchedPaths(): string[] {
  return mockUseFetch.mock.calls.map((c) => String(c[0]));
}

describe('attendance history page', () => {
  it('shows summary cards, class/date groups and the corrected marker', async () => {
    const tree = render(<AttendanceHistory />);

    await waitFor(() => expect(tree.getByTestId('history-pct')).toBeTruthy());
    expect(tree.getByText('81%')).toBeTruthy();
    expect(tree.getByText('3')).toBeTruthy(); // corrected count card

    // Date-wise view by default: one group per date, newest first.
    expect(tree.getByTestId('history-group-2026-10-22')).toBeTruthy();
    expect(tree.getByTestId('history-group-2026-10-21')).toBeTruthy();
    expect(tree.getByTestId('history-row-r1')).toBeTruthy();
    expect(tree.getByTestId('history-corrected-r2')).toBeTruthy();
    expect(tree.getByText(/corrected from present/)).toBeTruthy();

    // Paging shows the server envelope (42 marks / 20 per page = 3 pages).
    expect(tree.getByText('1 / 3')).toBeTruthy();

    tree.unmount();
  });

  it('sends filter and paging changes to the server as query changes', async () => {
    const tree = render(<AttendanceHistory />);
    await waitFor(() => expect(tree.getByTestId('history-status-absent')).toBeTruthy());

    fireEvent.press(tree.getByTestId('history-status-absent'));
    await waitFor(() =>
      expect(fetchedPaths().some((p) => p.includes('status=absent') && p.includes('page=1'))).toBe(true),
    );

    fireEvent.press(tree.getByTestId('page-next'));
    await waitFor(() => expect(fetchedPaths().some((p) => p.includes('page=2'))).toBe(true));

    // Class-wise grouping switches the group headers to course labels.
    fireEvent.press(tree.getByTestId('history-group-course'));
    await waitFor(() => expect(tree.getByTestId('history-group-Database Systems CS301')).toBeTruthy());

    tree.unmount();
  });

  it('exports the filtered CSV with the auth header and opens it', async () => {
    const tree = render(<AttendanceHistory />);
    await waitFor(() => expect(tree.getByTestId('export-csv')).toBeTruthy());

    fireEvent.press(tree.getByTestId('export-csv'));

    await waitFor(() => expect(mockDownloadFile).toHaveBeenCalled());
    const [url, fileName, , headers] = mockDownloadFile.mock.calls[0] as any[];

    expect(url).toContain('http://test/api/attendance/history?');
    expect(url).toContain('format=csv');
    expect(url).toContain('sort=date');
    expect(fileName).toMatch(/^attendance-history-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(headers).toEqual({ Authorization: 'Bearer test-token' });

    await waitFor(() => expect(mockOpenFile).toHaveBeenCalledWith('/docs/attendance.csv'));
    expect(Alert.alert).not.toHaveBeenCalled();

    tree.unmount();
  });

  it('surfaces a failed export instead of failing silently', async () => {
    mockDownloadFile.mockRejectedValue(new Error('Download failed with status 401'));

    const tree = render(<AttendanceHistory />);
    await waitFor(() => expect(tree.getByTestId('export-pdf')).toBeTruthy());
    fireEvent.press(tree.getByTestId('export-pdf'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Export failed', expect.stringContaining('401')),
    );

    tree.unmount();
  });
});
