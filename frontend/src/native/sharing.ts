import { Share } from 'react-native';

export async function isAvailableAsync() {
  return true;
}

export async function shareAsync(
  uri: string,
  options?: { dialogTitle?: string; mimeType?: string },
) {
  await Share.share({ message: uri, title: options?.dialogTitle });
}
