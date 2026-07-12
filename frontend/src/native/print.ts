import { Share } from 'react-native';

export async function printAsync({ html }: { html: string }) {
  await Share.share({ message: html });
}
