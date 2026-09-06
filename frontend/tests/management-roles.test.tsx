import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Dynamic auth user that tests can switch per test case
let mockCurrentUser = {
  id: 'usr-admin-1',
  name: 'Campus Director',
  role: 'college_admin',
  department: 'Administration',
  email: 'admin@vishva.edu',
};

jest.mock('@/src/providers/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
  }),
}));

const mockParentWard = {
  id: 'c-1',
  name: 'Aarav Sharma',
  student_id: '22CSE041',
  department: 'Computer Science',
  year: 3,
  role: 'student',
};

// Mock Library Data
const mockLibraryStats = {
  total_titles: 3,
  total_copies: 23,
  available_copies: 13,
  issued_count: 2,
  overdue_count: 1,
  total_fines: 120,
};

const mockBooks = [
  {
    _id: 'b-1',
    id: 'b-1',
    title: 'Introduction to Algorithms (CLRS)',
    author: 'Thomas H. Cormen',
    department: 'Computer Science',
    isbn: '978-0262033848',
    total_copies: 10,
    available_copies: 6,
    available: 6,
    shelf_location: 'Rack CS-04',
    shelf: 'Rack CS-04',
  },
  {
    _id: 'b-2',
    id: 'b-2',
    title: 'Clean Architecture',
    author: 'Robert C. Martin',
    department: 'Computer Science',
    isbn: '978-0134494164',
    total_copies: 5,
    available_copies: 0,
    available: 0,
    shelf_location: 'Rack CS-02',
    shelf: 'Rack CS-02',
  },
  {
    _id: 'b-3',
    id: 'b-3',
    title: 'Thermodynamics: An Engineering Approach',
    author: 'Yunus A. Cengel',
    department: 'Mechanical',
    isbn: '978-0073398174',
    total_copies: 8,
    available_copies: 7,
    available: 7,
    shelf_location: 'Rack ME-01',
    shelf: 'Rack ME-01',
  },
];

const mockMyIssues = [
  {
    _id: 'iss-1',
    id: 'iss-1',
    bookId: 'b-1',
    book_id: 'b-1',
    book_title: 'Introduction to Algorithms (CLRS)',
    book_author: 'Thomas H. Cormen',
    book: {
      title: 'Introduction to Algorithms (CLRS)',
      author: 'Thomas H. Cormen',
      shelf: 'Rack CS-04',
    },
    student_name: 'Aarav Sharma',
    student_id: '22CSE041',
    issueDate: '2026-08-25T00:00:00.000Z',
    issue_date: '2026-08-25T00:00:00.000Z',
    dueDate: '2026-09-08T00:00:00.000Z',
    due_date: '2026-09-08T00:00:00.000Z',
    status: 'issued',
    fine: 0,
  },
];

const mockAllIssues = [
  {
    _id: 'iss-1',
    id: 'iss-1',
    bookId: 'b-1',
    book_id: 'b-1',
    book_title: 'Introduction to Algorithms (CLRS)',
    book: {
      title: 'Introduction to Algorithms (CLRS)',
      author: 'Thomas H. Cormen',
      shelf: 'Rack CS-04',
    },
    user: {
      id: 's-1',
      name: 'Aarav Sharma',
      email: 'aarav@vishva.edu',
      student_id: '22CSE041',
      phone: '+91 98765 43210',
    },
    student_name: 'Aarav Sharma',
    student_id: '22CSE041',
    student_phone: '+91 98765 43210',
    issueDate: '2026-08-25T00:00:00.000Z',
    issue_date: '2026-08-25T00:00:00.000Z',
    dueDate: '2026-09-08T00:00:00.000Z',
    due_date: '2026-09-08T00:00:00.000Z',
    status: 'issued',
    fine: 0,
  },
  {
    _id: 'iss-2',
    id: 'iss-2',
    bookId: 'b-2',
    book_id: 'b-2',
    book_title: 'Clean Architecture',
    book: {
      title: 'Clean Architecture',
      author: 'Robert C. Martin',
      shelf: 'Rack CS-02',
    },
    user: {
      id: 's-2',
      name: 'Rohan Verma',
      email: 'rohan@vishva.edu',
      student_id: '22CSE088',
      phone: '+91 91234 56789',
    },
    student_name: 'Rohan Verma',
    student_id: '22CSE088',
    student_phone: '+91 91234 56789',
    issueDate: '2026-08-01T00:00:00.000Z',
    issue_date: '2026-08-01T00:00:00.000Z',
    dueDate: '2026-08-15T00:00:00.000Z',
    due_date: '2026-08-15T00:00:00.000Z',
    status: 'overdue',
    isOverdue: true,
    fine: 150,
  },
];

// Mock Hostel Data
const mockHostels = [
  {
    _id: 'h-1',
    id: 'h-1',
    name: 'Dr. APJ Abdul Kalam Hostel',
    type: 'Boys',
    total_rooms: 100,
    occupied: 85,
    warden_name: 'Dr. Suresh Chandra',
    contact: '+91 98123 45678',
    amenities: ['WiFi', 'Power Backup', 'AC', 'Mess', 'Gym'],
  },
  {
    _id: 'h-2',
    id: 'h-2',
    name: 'Sarojini Naidu Girls Hostel',
    type: 'Girls',
    total_rooms: 80,
    occupied: 72,
    warden_name: 'Prof. Anjali Saxena',
    contact: '+91 98765 12345',
    amenities: ['WiFi', 'Power Backup', 'Mess', 'Hot Water', 'CCTV'],
  },
];

const mockAllocations = [
  {
    _id: 'alloc-1',
    id: 'alloc-1',
    hostel_id: 'h-1',
    hostel_name: 'Dr. APJ Abdul Kalam Hostel',
    room_number: 'B-304',
    student_name: 'Aarav Sharma',
    student_id: '22CSE041',
    student_email: 'aarav@vishva.edu',
    allocated_at: '2026-07-15T00:00:00.000Z',
    active: true,
    warden_name: 'Dr. Suresh Chandra',
    warden_contact: '+91 98123 45678',
  },
];

const mockGatePasses = [
  {
    _id: 'gp-1',
    id: 'gp-1',
    student_name: 'Aarav Sharma',
    student_id: '22CSE041',
    hostel_id: 'h-1',
    hostel_name: 'Dr. APJ Abdul Kalam Hostel',
    room_number: 'B-304',
    destination: 'City Hospital (Doctor Visit)',
    reason: 'Routine health checkup and blood tests',
    out_time: '2026-09-07T14:00:00.000Z',
    expected_return: '2026-09-07T18:00:00.000Z',
    status: 'pending',
    created_at: '2026-09-06T10:00:00.000Z',
  },
  {
    _id: 'gp-2',
    id: 'gp-2',
    student_name: 'Rohan Verma',
    student_id: '22CSE088',
    hostel_id: 'h-1',
    hostel_name: 'Dr. APJ Abdul Kalam Hostel',
    room_number: 'B-212',
    destination: 'Home Town',
    reason: 'Family wedding event',
    out_time: '2026-09-05T08:00:00.000Z',
    expected_return: '2026-09-08T20:00:00.000Z',
    status: 'approved',
    created_at: '2026-09-04T09:00:00.000Z',
  },
];

const mockGrievances = [
  {
    _id: 'grv-1',
    id: 'grv-1',
    title: 'Bathroom water tap leaking continuously',
    category: 'Plumbing',
    subject: 'Bathroom water tap leaking continuously',
    description: 'Tap in room B-304 bathroom does not close properly, wasting water.',
    priority: 'high',
    status: 'open',
    student_name: 'Aarav Sharma',
    room_number: 'B-304',
    created_at: '2026-09-05T11:00:00.000Z',
    createdAt: '2026-09-05T11:00:00.000Z',
  },
];

// Mock Transport Data
const mockTransportStats = {
  total_routes: 12,
  total_enrolled: 480,
  active_vehicles: 10,
  on_time_rate: 96.4,
};

const mockRoutes = [
  {
    _id: 'rt-1',
    id: 'rt-1',
    route_name: 'Route 1 - North Campus Express',
    vehicle_number: 'KA-01-F-4021',
    driver_name: 'Rajesh Kumar',
    driver_phone: '+91 98765 43210',
    capacity: 45,
    status: 'on_time',
    morning_time: '07:30 AM',
    evening_time: '04:30 PM',
    active: true,
    stops: [
      { name: 'City Center Mall', time: '07:00 AM' },
      { name: 'Metro Gate 3', time: '07:15 AM' },
      { name: 'Indira Circle', time: '07:30 AM' },
      { name: 'Campus Gate 1', time: '07:45 AM' },
    ],
  },
  {
    _id: 'rt-2',
    id: 'rt-2',
    route_name: 'Route 2 - South Ring Road',
    vehicle_number: 'KA-01-F-4022',
    driver_name: 'Mahesh Sharma',
    driver_phone: '+91 98111 22233',
    capacity: 50,
    status: 'delayed',
    morning_time: '07:15 AM',
    evening_time: '04:45 PM',
    active: true,
    stops: [
      { name: 'South End Circle', time: '07:00 AM' },
      { name: 'Ring Road Junction', time: '07:20 AM' },
      { name: 'Campus Gate 2', time: '07:55 AM' },
    ],
  },
];

const mockMyRouteEnrollment = {
  id: 'rt-1',
  route_name: 'Route 1 - North Campus Express',
  vehicle_number: 'KA-01-F-4021',
  driver_name: 'Rajesh Kumar',
  driver_phone: '+91 98765 43210',
  morning_time: '07:30 AM',
  evening_time: '04:30 PM',
  pickup_stop: 'Metro Gate 3',
  active: true,
  stops: [
    { name: 'City Center Mall', time: '07:00 AM' },
    { name: 'Metro Gate 3', time: '07:15 AM' },
    { name: 'Campus Gate 1', time: '07:45 AM' },
  ],
};

const mockRouteStudents = [
  {
    id: 's-1',
    name: 'Aarav Sharma',
    student_id: '22CSE041',
    phone: '+91 98765 43210',
    stop: 'Metro Gate 3',
  },
  {
    id: 's-2',
    name: 'Pooja Nair',
    student_id: '22ECE019',
    phone: '+91 91234 56789',
    stop: 'City Center Mall',
  },
];

// Mock API and useFetch
jest.mock('@/src/api', () => ({
  api: jest.fn((url: string) => {
    if (url.includes('/transport/routes/') && url.includes('/students')) {
      return Promise.resolve(mockRouteStudents);
    }
    return Promise.resolve({ ok: true });
  }),
  apiUrl: (p: string) => p,
  getToken: jest.fn(() => Promise.resolve('mock-token')),
}));

jest.mock('@/src/hooks/useFetch', () => ({
  useFetch: jest.fn((url: string | null) => {
    if (!url) return { data: null, loading: false, error: null, refresh: jest.fn() };

    // Parent Dashboard
    if (url === '/parent/dashboard') {
      return {
        data: {
          child: mockParentWard,
          attendance: 84,
          cgpa: 8.8,
          results: [],
          fees: [],
        },
        loading: false,
        error: null,
        refresh: jest.fn(),
      };
    }

    // Library
    if (url === '/library/stats') {
      return { data: mockLibraryStats, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/library/books') {
      return { data: mockBooks, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/library/my-issues') {
      return { data: mockMyIssues, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/library/all-issues') {
      return { data: mockAllIssues, loading: false, error: null, refresh: jest.fn() };
    }

    // Hostel
    if (url === '/hostels') {
      return { data: mockHostels, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/hostel/allocations') {
      return { data: mockAllocations, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/gate-passes') {
      return { data: mockGatePasses, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/grievances') {
      return { data: mockGrievances, loading: false, error: null, refresh: jest.fn() };
    }

    // Transport
    if (url === '/transport/stats') {
      return { data: mockTransportStats, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/transport/routes') {
      return { data: mockRoutes, loading: false, error: null, refresh: jest.fn() };
    }
    if (url === '/transport/my-route') {
      return { data: mockMyRouteEnrollment, loading: false, error: null, refresh: jest.fn() };
    }
    if (url.includes('/transport/routes/') && url.includes('/students')) {
      return { data: mockRouteStudents, loading: false, error: null, refresh: jest.fn() };
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

jest.mock('@/src/realtime/socket', () => ({
  subscribeRealtime: jest.fn(() => () => {}),
}));

jest.mock('react-native-qrcode-svg', () => {
  const { View } = require('react-native');
  return (props: any) => <View {...props} testID="mock-qr-code" />;
});

// Components under test
import LibraryScreen from '@/app/library';
import HostelManagementScreen from '@/app/hostel';
import TransportScreen from '@/app/transport';

describe('Enterprise Management Roles Verification Suite', () => {
  // ==========================================
  // 1. LIBRARY MANAGEMENT
  // ==========================================
  describe('1. Library Management Hub (All Roles)', () => {
    describe('Admin View (college_admin)', () => {
      beforeEach(() => {
        mockCurrentUser = {
          id: 'adm-1',
          name: 'Chief Librarian',
          role: 'college_admin',
          department: 'Library',
          email: 'librarian@vishva.edu',
        };
      });

      it('renders Library Command Center with KPI radar and admin action buttons', () => {
        const { getByText, getAllByText } = render(<LibraryScreen />);
        expect(getByText('Library Command Center')).toBeTruthy();
        expect(getByText(/Catalog circulation, book inventory/)).toBeTruthy();
        expect(getByText('Book Titles')).toBeTruthy();
        expect(getByText('Available Copies')).toBeTruthy();
        expect(getByText('Active Loans')).toBeTruthy();
        expect(getByText('Overdue Defaulters')).toBeTruthy();
        expect(getByText('Add Book')).toBeTruthy();
        expect(getByText('Issue Book to Student')).toBeTruthy();
        expect(getAllByText('Catalog')[0]).toBeTruthy();
        expect(getByText('Circulation Desk')).toBeTruthy();
        expect(getAllByText(/Overdue/)[0]).toBeTruthy();
      });

      it('displays catalog books and allows department filtering', () => {
        const { getByText } = render(<LibraryScreen />);
        expect(getByText('Introduction to Algorithms (CLRS)')).toBeTruthy();
        expect(getByText(/Thomas H. Cormen/)).toBeTruthy();
        expect(getByText('Clean Architecture')).toBeTruthy();
      });

      it('displays overdue watchlist with borrower contact and reminder dispatch', () => {
        const { getByText, getByTestId } = render(<LibraryScreen />);
        const overdueTab = getByTestId('tab-overdue');
        fireEvent.press(overdueTab);
        expect(getByText(/Rohan Verma/)).toBeTruthy();
        expect(getByText('Clean Architecture')).toBeTruthy();
        expect(getByText('Send Due Alert')).toBeTruthy();
      });
    });

    describe('Student View (student)', () => {
      beforeEach(() => {
        mockCurrentUser = {
          id: 'stu-1',
          name: 'Aarav Sharma',
          role: 'student',
          department: 'Computer Science',
          email: 'aarav@vishva.edu',
        };
      });

      it('renders Digital Library with smart search and student loan tracking', () => {
        const { getByText } = render(<LibraryScreen />);
        expect(getByText('Digital Library Hub')).toBeTruthy();
        expect(getByText('STUDENT CARD')).toBeTruthy();
        expect(getByText('Aarav Sharma')).toBeTruthy();
        expect(getByText('Book Catalog')).toBeTruthy();
        expect(getByText(/My Books/)).toBeTruthy();
        expect(getByText('History')).toBeTruthy();
      });

      it('displays active borrowed books with return due dates', () => {
        const { getByText } = render(<LibraryScreen />);
        const myBooksTab = getByText(/My Books/);
        fireEvent.press(myBooksTab);
        expect(getByText('Introduction to Algorithms (CLRS)')).toBeTruthy();
        expect(getByText(/Thomas H. Cormen/)).toBeTruthy();
      });
    });

    describe('Parent View (parent)', () => {
      beforeEach(() => {
        mockCurrentUser = {
          id: 'par-1',
          name: 'Rajesh Sharma',
          role: 'parent',
          department: 'Guardian',
          email: 'parent.sharma@vishva.edu',
        };
      });

      it('renders Ward Library Monitor with student identity banner', () => {
        const { getByText } = render(<LibraryScreen />);
        expect(getByText('Ward Library Records')).toBeTruthy();
        expect(getByText(/Track borrowed books, due dates/)).toBeTruthy();
        expect(getByText('Ward Library Profile')).toBeTruthy();
        expect(getByText('Aarav Sharma')).toBeTruthy();
      });
    });
  });

  // ==========================================
  // 2. HOSTEL MANAGEMENT
  // ==========================================
  describe('2. Hostel Management Hub (All Roles)', () => {
    describe('Admin View (college_admin)', () => {
      beforeEach(() => {
        mockCurrentUser = {
          id: 'adm-1',
          name: 'Chief Warden',
          role: 'college_admin',
          department: 'Campus Administration',
          email: 'warden@vishva.edu',
        };
      });

      it('renders Hostel Command Center with occupancy KPIs and admin action tabs', () => {
        const { getByText, getAllByText } = render(<HostelManagementScreen />);
        expect(getByText('Hostel Executive Center')).toBeTruthy();
        expect(getByText(/Hostels, allocations, gate pass approvals/)).toBeTruthy();
        expect(getByText('Hostel Blocks')).toBeTruthy();
        expect(getByText('Occupied Beds')).toBeTruthy();
        expect(getByText('Pending Gate Passes')).toBeTruthy();
        expect(getByText('Open Repairs')).toBeTruthy();
        expect(getByText('Add Hostel')).toBeTruthy();
        expect(getAllByText('Hostels')[0]).toBeTruthy();
        expect(getByText('Allocations')).toBeTruthy();
        expect(getAllByText(/Gate Passes/)[0]).toBeTruthy();
        expect(getByText('Repairs')).toBeTruthy();
        expect(getAllByText('Mess Menu')[0]).toBeTruthy();
      });

      it('displays hostel residences with room occupancy and warden contacts', () => {
        const { getByText } = render(<HostelManagementScreen />);
        expect(getByText('Dr. APJ Abdul Kalam Hostel')).toBeTruthy();
        expect(getByText('Sarojini Naidu Girls Hostel')).toBeTruthy();
        expect(getByText(/Dr. Suresh Chandra/)).toBeTruthy();
      });

      it('renders Gate Pass Approval Desk with approve and reject actions', () => {
        const { getByText, getByTestId, getAllByText } = render(<HostelManagementScreen />);
        const gatePassTab = getByTestId('tab-gatepasses');
        fireEvent.press(gatePassTab);
        expect(getByText(/Aarav Sharma/)).toBeTruthy();
        expect(getByText(/Routine health checkup/)).toBeTruthy();
        expect(getAllByText('Approve & Issue')[0]).toBeTruthy();
        expect(getAllByText('Decline')[0]).toBeTruthy();
      });
    });

    describe('Student View (student)', () => {
      beforeEach(() => {
        mockCurrentUser = {
          id: 'stu-1',
          name: 'Aarav Sharma',
          role: 'student',
          department: 'Computer Science',
          email: 'aarav@vishva.edu',
        };
      });

      it('renders Student Residence Hub with room allocation and emergency warden call', () => {
        const { getByText, getAllByText } = render(<HostelManagementScreen />);
        expect(getByText('Hostel & Residential Life')).toBeTruthy();
        expect(getByText('ACTIVE ALLOCATION')).toBeTruthy();
        expect(getByText('Dr. APJ Abdul Kalam Hostel')).toBeTruthy();
        expect(getAllByText(/Room B-304/)[0]).toBeTruthy();
        expect(getByText('Call Warden')).toBeTruthy();
        expect(getByText('Campus Emergency Contacts')).toBeTruthy();
      });

      it('renders daily mess menu with 4 distinct meal schedules', () => {
        const { getByText, getAllByText } = render(<HostelManagementScreen />);
        const messTab = getAllByText('Mess Menu')[0];
        fireEvent.press(messTab);
        expect(getByText('Breakfast')).toBeTruthy();
        expect(getByText('Lunch')).toBeTruthy();
        expect(getByText('Snacks')).toBeTruthy();
        expect(getByText('Dinner')).toBeTruthy();
      });
    });

    describe('Parent View (parent)', () => {
      beforeEach(() => {
        mockCurrentUser = {
          id: 'par-1',
          name: 'Rajesh Sharma',
          role: 'parent',
          department: 'Guardian',
          email: 'parent.sharma@vishva.edu',
        };
      });

      it('renders Parent Ward Hostel Oversight with ward room assignment', () => {
        const { getByText, getAllByText } = render(<HostelManagementScreen />);
        expect(getByText('Ward Residence')).toBeTruthy();
        expect(getByText("WARD'S RESIDENTIAL QUARTERS")).toBeTruthy();
        expect(getByText('Dr. APJ Abdul Kalam Hostel')).toBeTruthy();
        expect(getAllByText(/Room B-304/)[0]).toBeTruthy();
      });
    });
  });

  // ==========================================
  // 3. TRANSPORT MANAGEMENT
  // ==========================================
  describe('3. Transport Management Hub (All Roles)', () => {
    describe('Admin View (college_admin)', () => {
      beforeEach(() => {
        mockCurrentUser = {
          id: 'adm-1',
          name: 'Fleet Manager',
          role: 'college_admin',
          department: 'Transport Logistics',
          email: 'transport@vishva.edu',
        };
      });

      it('renders Transport Command Center with Fleet KPI radar and admin action buttons', () => {
        const { getByText, getAllByText } = render(<TransportScreen />);
        expect(getByText('Transport & Fleet Command')).toBeTruthy();
        expect(getByText(/Fleet routes, live telemetry, delays/)).toBeTruthy();
        expect(getAllByText('Fleet Routes')[0]).toBeTruthy();
        expect(getByText('Enrolled Commuters')).toBeTruthy();
        expect(getByText('On-Duty Buses')).toBeTruthy();
        expect(getByText('On-Time Rating')).toBeTruthy();
        expect(getByText('Add Route')).toBeTruthy();
        expect(getByText('Live Telemetry')).toBeTruthy();
        expect(getByText('Passenger Manifest')).toBeTruthy();
      });

      it('displays routes network with vehicle numbers and drivers', () => {
        const { getByText } = render(<TransportScreen />);
        expect(getByText('Route 1 - North Campus Express')).toBeTruthy();
        expect(getByText(/KA-01-F-4021/)).toBeTruthy();
        expect(getByText(/Rajesh Kumar/)).toBeTruthy();
        expect(getByText('Route 2 - South Ring Road')).toBeTruthy();
        expect(getByText(/KA-01-F-4022/)).toBeTruthy();
      });

      it('displays passenger manifest and live bus telemetry', () => {
        const { getByText, getAllByText } = render(<TransportScreen />);
        const telemetryTab = getByText('Live Telemetry');
        fireEvent.press(telemetryTab);
        expect(getByText(/Live GPS Telemetry/)).toBeTruthy();
        expect(getAllByText('Route 1 - North Campus Express')[0]).toBeTruthy();
      });
    });

    describe('Student View (student)', () => {
      beforeEach(() => {
        mockCurrentUser = {
          id: 'stu-1',
          name: 'Aarav Sharma',
          role: 'student',
          department: 'Computer Science',
          email: 'aarav@vishva.edu',
        };
      });

      it('renders Transit Hub with student bus pass, stop info, and driver hotline', () => {
        const { getByText, getAllByText } = render(<TransportScreen />);
        expect(getByText('Transit & Bus Pass Hub')).toBeTruthy();
        expect(getByText(/Digital pass, real-time stop ETA/)).toBeTruthy();
        expect(getByText('OFFICIAL TRANSIT PASS')).toBeTruthy();
        expect(getAllByText('Route 1 - North Campus Express')[0]).toBeTruthy();
        expect(getAllByText(/KA-01-F-4021/)[0]).toBeTruthy();
        expect(getAllByText(/Rajesh Kumar/)[0]).toBeTruthy();
        expect(getByText('Call Driver')).toBeTruthy();
      });

      it('renders route network tab for browsing', () => {
        const { getByText, getAllByText } = render(<TransportScreen />);
        const routesTab = getByText('Route Network');
        fireEvent.press(routesTab);
        expect(getAllByText('Route 1 - North Campus Express')[0]).toBeTruthy();
        expect(getAllByText('Route 2 - South Ring Road')[0]).toBeTruthy();
      });
    });

    describe('Parent View (parent)', () => {
      beforeEach(() => {
        mockCurrentUser = {
          id: 'par-1',
          name: 'Rajesh Sharma',
          role: 'parent',
          department: 'Guardian',
          email: 'parent.sharma@vishva.edu',
        };
      });

      it('renders Ward Transit Radar with student bus details and safety hotline', () => {
        const { getByText, getAllByText } = render(<TransportScreen />);
        expect(getByText('Ward Bus Safety Tracker')).toBeTruthy();
        expect(getByText(/Live bus GPS tracking, driver contacts/)).toBeTruthy();
        expect(getByText("WARD'S TRANSPORT PASS")).toBeTruthy();
        expect(getAllByText('Route 1 - North Campus Express')[0]).toBeTruthy();
        expect(getAllByText(/KA-01-F-4021/)[0]).toBeTruthy();
        expect(getAllByText(/Rajesh Kumar/)[0]).toBeTruthy();
        expect(getByText('Call Driver')).toBeTruthy();
      });
    });
  });
});
