import { Platform, Vibration } from 'react-native';

export const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
} as const;

export async function notificationAsync(_type?: string) {
  if (Platform.OS !== 'web') {
    Vibration.vibrate(25);
  }
}
