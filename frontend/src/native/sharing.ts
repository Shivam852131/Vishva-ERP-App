import { Share, Platform } from 'react-native';

export async function isAvailableAsync() {
  return true;
}

export async function shareAsync(
  uri: string,
  options?: { dialogTitle?: string; mimeType?: string },
) {
  if (Platform.OS === 'ios') {
    await Share.share({ url: uri, title: options?.dialogTitle });
  } else {
    await Share.share({ message: uri, title: options?.dialogTitle });
  }
}
