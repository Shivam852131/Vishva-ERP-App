import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockWriteFile = jest.fn(() => Promise.resolve());
const mockScanFile = jest.fn(() => Promise.resolve());
const mockCaptureRef = jest.fn(() => Promise.resolve('data_base64_string'));

jest.mock('react-native-fs', () => ({
  default: {
    writeFile: mockWriteFile,
    scanFile: mockScanFile,
    DownloadDirectoryPath: '/mock/downloads',
    DocumentDirectoryPath: '/mock/documents',
  },
  writeFile: mockWriteFile,
  scanFile: mockScanFile,
  DownloadDirectoryPath: '/mock/downloads',
  DocumentDirectoryPath: '/mock/documents',
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: mockCaptureRef,
}));

jest.mock('react-native-qrcode-svg', () => {
  const { View } = require('react-native');
  return function MockQRCode() {
    return <View testID="mock-qr-code" />;
  };
});

jest.mock('@/src/navigation/router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/src/providers/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'stu-12345',
      name: 'Shivam Kumar',
      role: 'student',
      department: 'Computer Science',
      email: 'shivam@example.com',
      phone: '+91 9876543210',
      year: 3,
      student_id: 'CS-2026-001',
      cgpa: 9.2,
      collegeName: 'Vishva Institute of Technology',
    },
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
  }),
}));

import IdCardScreen from '@/app/id-card';

describe('IdCardScreen - Download & Export Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('renders Digital ID card details correctly', () => {
    const { getAllByText, getByText } = render(<IdCardScreen />);
    expect(getAllByText('SHIVAM KUMAR').length).toBeGreaterThan(0);
    expect(getAllByText('CS-2026-001').length).toBeGreaterThan(0);
    expect(getByText('Download')).toBeTruthy();
    expect(getByText('Share')).toBeTruthy();
    expect(getByText('Verify')).toBeTruthy();
  });

  it('opens download format modal when tapping Download button', () => {
    const { getByText, getByLabelText } = render(<IdCardScreen />);
    const downloadBtn = getByLabelText('Download ID card');
    fireEvent.press(downloadBtn);

    expect(getByText('Download ID Card')).toBeTruthy();
    expect(getByText('Front Card (PNG)')).toBeTruthy();
    expect(getByText('Back Card (PNG)')).toBeTruthy();
    expect(getByText('Printable Document (PDF / HTML)')).toBeTruthy();
  });

  it('successfully downloads front card PNG image', async () => {
    const { getByText, getByLabelText } = render(<IdCardScreen />);
    fireEvent.press(getByLabelText('Download ID card'));

    const frontOption = getByText('Front Card (PNG)');
    fireEvent.press(frontOption);

    await waitFor(() => {
      expect(mockCaptureRef).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ format: 'png', quality: 1, result: 'base64' })
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringMatching(/ID_Card_.*_FRONT_.*\.png/),
        'data_base64_string',
        'base64'
      );
      expect(Alert.alert).toHaveBeenCalledWith(
        'Card Downloaded Successfully',
        expect.stringContaining('FRONT card to Downloads'),
        expect.any(Array)
      );
    });
  });

  it('successfully downloads back card PNG image', async () => {
    const { getByText, getByLabelText } = render(<IdCardScreen />);
    fireEvent.press(getByLabelText('Download ID card'));

    const backOption = getByText('Back Card (PNG)');
    fireEvent.press(backOption);

    await waitFor(() => {
      expect(mockCaptureRef).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ format: 'png', quality: 1, result: 'base64' })
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringMatching(/ID_Card_.*_BACK_.*\.png/),
        'data_base64_string',
        'base64'
      );
    });
  });

  it('successfully generates printable HTML/PDF with both Front and Back sides', async () => {
    const { getByText, getByLabelText } = render(<IdCardScreen />);
    fireEvent.press(getByLabelText('Download ID card'));

    const printableOption = getByText('Printable Document (PDF / HTML)');
    fireEvent.press(printableOption);

    await waitFor(() => {
      // Must capture both front and back
      expect(mockCaptureRef).toHaveBeenCalledTimes(2);
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringMatching(/ID_Card_.*_Printable_.*\.html/),
        expect.stringContaining('OFFICIAL DIGITAL IDENTITY CARD'),
        'utf8'
      );
      expect(Alert.alert).toHaveBeenCalledWith(
        'Printable Card Saved',
        expect.stringContaining('Document saved to Downloads'),
        expect.any(Array)
      );
    });
  });

  it('displays an alert if download fails gracefully instead of crashing', async () => {
    mockCaptureRef.mockRejectedValueOnce(new Error('Canvas render error'));

    const { getByText, getByLabelText } = render(<IdCardScreen />);
    fireEvent.press(getByLabelText('Download ID card'));

    const frontOption = getByText('Front Card (PNG)');
    fireEvent.press(frontOption);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Download Failed',
        'Canvas render error'
      );
    });
  });
});
