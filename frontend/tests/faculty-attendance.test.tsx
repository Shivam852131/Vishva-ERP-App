import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import FacultyAttendanceConsole from '@/app/faculty-attendance';
import FacultyAttendanceCourse from '@/app/faculty-attendance-course';

// Regression coverage for the faculty attendance console: course-scoped
// reporting, the shortage line, and the roster drill-down.

const mockPush = jest.fn();

jest.mock('@/src/navigation/router', () => ({
  router: { push: (p: any) => mockPush(p), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: (p: any) => mockPush(p), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'c1' }),
}));

const mockOverview = {
  period_days: 30,
  threshold: 75,
  faculty_only: true,
  truncated: false,
  totals: {
    courses: 2,
    sessions: 6,
    students: 40,
    present: 30,
    late: 4,
    absent: 6,
    classes_marked: 40,
    defaulters: 1,
    percentage: 85,
  },
  courses: [
    {
      id: 'c1', name: 'Database Systems', code: 'CS301', department: 'CSE', semester: '5',
      enrolled: 20, sessions: 4, present: 14, late: 2, absent: 4, classes_marked: 20, percentage: 70,
    },
    {
      id: 'c2', name: 'Operating Systems', code: 'CS302', department: 'CSE', semester: '5',
      enrolled: 20, sessions: 2, present: 16, late: 2, absent: 2, classes_marked: 20, percentage: 90,
    },
  ],
  defaulters: [
    {
      student_id: 's1', name: 'Aarav Sharma', student_code: '22CSE041',
      percentage: 55, shortfall_classes: 6,
      course_id: 'c1', course_name: 'Database Systems', course_percentage: 55,
      present: 11, late: 0, absent: 9, total: 20,
    },
  ],
  trend: [
    { date: '2026-10-21', percentage: 80, marked: 5 },
    { date: '2026-10-22', percentage: 60, marked: 5 },
  ],
  sessions: [
    {
      id: 'sess-1', course_id: 'c1', course_name: 'Database Systems', course_code: 'CS301',
      date: '2026-10-22', method: 'qr', active: true, present: 16, enrolled: 20, percentage: 80,
    },
  ],
};

const mockCourse = {
  threshold: 75,
  period: { startDate: '2000-01-01', endDate: '2026-10-22' },
  course: { id: 'c1', name: 'Database Systems', code: 'CS301', department: 'CSE', semester: '5' },
  summary: {
    present: 22, late: 3, absent: 15, classes_marked: 40, sessions: 4,
    enrolled: 3, marked: 3, defaulters: 1, percentage: 80,
  },
  students: [
    {
      id: 's1', name: 'Aarav Sharma', student_code: '22CSE041', enrolled: true,
      present: 4, late: 0, absent: 16, total: 20, percentage: 20,
      status: 'critical', shortfall_classes: 4,
      history: { '2026-10-01': 'absent', '2026-10-02': 'present' },
    },
    {
      id: 's2', name: 'Good Student', student_code: '22CSE042', enrolled: true,
      present: 18, late: 1, absent: 1, total: 20, percentage: 95,
      status: 'safe', shortfall_classes: 0, history: {},
    },
    {
      id: 's3', name: 'Never Marked', student_code: '22CSE043', enrolled: true,
      present: 0, late: 0, absent: 0, total: 0, percentage: 0,
      status: 'unmarked', shortfall_classes: 0, history: {},
    },
  ],
  sessions: [
    { id: 'sess-1', date: '2026-10-22', method: 'qr', active: true, present: 16, enrolled: 3, percentage: 80 },
  ],
};

jest.mock('@/src/hooks/useFetch', () => ({
  useFetch: jest.fn((url: string) => {
    if (url === '/attendance/faculty/overview?days=30') {
      return { data: mockOverview, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/attendance/faculty/course/c1') {
      return { data: mockCourse, loading: false, error: null, refresh: jest.fn() };
    }
    return { data: undefined, loading: true, error: null, refresh: jest.fn() };
  }),
}));

jest.mock('@/src/providers/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'f1', name: 'Faculty', role: 'faculty' }, loading: false }),
}));

beforeEach(() => {
  mockPush.mockClear();
});

describe('Faculty attendance console', () => {
  it('shows the overall percentage against the shortage line', async () => {
    const tree = render(<FacultyAttendanceConsole />);

    await waitFor(() => expect(tree.getByText('75% shortage line')).toBeTruthy());
    // The ring and the hero figure both render this value.
    expect(tree.getAllByText('85%').length).toBeGreaterThan(0);
    expect(tree.getByTestId('fac-att-defaulters')).toBeTruthy();
    tree.unmount();
  });

  it('labels the console as scoped to the faculty member own courses', async () => {
    const tree = render(<FacultyAttendanceConsole />);
    await waitFor(() => expect(tree.getByText('Your courses only')).toBeTruthy());
    expect(tree.getByText('Faculty')).toBeTruthy();
    tree.unmount();
  });

  it('lists courses with their percentages', async () => {
    const tree = render(<FacultyAttendanceConsole />);
    fireEvent.press(tree.getByRole('tab', { name: 'Courses' }));

    await waitFor(() => expect(tree.getByText('Database Systems')).toBeTruthy());
    expect(tree.getByText('Operating Systems')).toBeTruthy();
    expect(tree.getByText('70%')).toBeTruthy();
    expect(tree.getByText('90%')).toBeTruthy();
    expect(tree.getAllByText('20 students')).toHaveLength(2);
    tree.unmount();
  });

  it('opens the course roster when a course is pressed', async () => {
    const tree = render(<FacultyAttendanceConsole />);
    fireEvent.press(tree.getByRole('tab', { name: 'Courses' }));
    await waitFor(() => expect(tree.getByText('Database Systems')).toBeTruthy());

    fireEvent.press(tree.getByLabelText('Database Systems, 70 percent'));
    expect(mockPush).toHaveBeenCalledWith('/faculty-attendance-course?id=c1');
    tree.unmount();
  });

  it('shows at-risk students with the classes needed to recover', async () => {
    const tree = render(<FacultyAttendanceConsole />);
    fireEvent.press(tree.getByRole('tab', { name: 'At risk' }));

    await waitFor(() => expect(tree.getByText('Aarav Sharma')).toBeTruthy());
    expect(tree.getByText('22CSE041 · Database Systems 55%')).toBeTruthy();
    expect(tree.getByText('Needs 6 more classes to reach 75%')).toBeTruthy();
    expect(tree.getByText('55%')).toBeTruthy();
    tree.unmount();
  });

  it('links a session through to the live roster', async () => {
    const tree = render(<FacultyAttendanceConsole />);
    fireEvent.press(tree.getByRole('tab', { name: 'Sessions' }));

    await waitFor(() => expect(tree.getByText('Database Systems')).toBeTruthy());
    expect(tree.getByText('16 of 20 attended')).toBeTruthy();

    fireEvent.press(tree.getByLabelText('Session on 2026-10-22'));
    expect(mockPush).toHaveBeenCalledWith('/attendance-live-advanced?sid=sess-1');
    tree.unmount();
  });
});

describe('Faculty course roster', () => {
  it('renders the course summary and every student with their risk band', async () => {
    const tree = render(<FacultyAttendanceCourse />);

    await waitFor(() => expect(tree.getByText('Database Systems')).toBeTruthy());
    expect(tree.getByTestId('course-att-pct')).toBeTruthy();
    expect(tree.getByText('Aarav Sharma')).toBeTruthy();
    expect(tree.getByText('Good Student')).toBeTruthy();
    expect(tree.getByText('Never Marked')).toBeTruthy();
    expect(tree.getByText('Risk')).toBeTruthy();
    expect(tree.getByText('No attendance recorded yet')).toBeTruthy();
    tree.unmount();
  });

  it('explains how far a critical student is from the line', async () => {
    const tree = render(<FacultyAttendanceCourse />);
    await waitFor(() => expect(tree.getByText('Aarav Sharma')).toBeTruthy());

    expect(tree.getByText('Needs 4 more classes to reach 75%')).toBeTruthy();
    tree.unmount();
  });

  it('filters down to at-risk students only', async () => {
    const tree = render(<FacultyAttendanceCourse />);
    await waitFor(() => expect(tree.getByText('Aarav Sharma')).toBeTruthy());

    fireEvent.press(tree.getByTestId('course-filter-critical'));

    await waitFor(() => expect(tree.getByText('Aarav Sharma')).toBeTruthy());
    expect(tree.queryByText('Good Student')).toBeNull();
    expect(tree.queryByText('Never Marked')).toBeNull();
    tree.unmount();
  });

  it('searches by name', async () => {
    const tree = render(<FacultyAttendanceCourse />);
    await waitFor(() => expect(tree.getByText('Aarav Sharma')).toBeTruthy());

    fireEvent.changeText(tree.getByPlaceholderText('Search students...'), 'good');

    await waitFor(() => expect(tree.queryByText('Aarav Sharma')).toBeNull());
    expect(tree.getByText('Good Student')).toBeTruthy();
    tree.unmount();
  });
});
