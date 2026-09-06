import { Platform, Alert, Linking } from 'react-native';
import RNFS from 'react-native-fs';

export async function printAsync({ html }: { html: string }) {
  try {
    const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
    const fileName = `Document_${Date.now()}.html`;
    const filePath = `${dir}/${fileName}`;
    await RNFS.writeFile(filePath, html, 'utf8');
    if (Platform.OS === 'android' && RNFS.scanFile) {
      await RNFS.scanFile(filePath);
    }
    Alert.alert(
      'Document Ready',
      `Saved as ${fileName} in Downloads. Open it to print or save as PDF.`,
      [
        { text: 'OK' },
        { text: 'Open', onPress: () => Linking.openURL(`file://${filePath}`) },
      ],
    );
  } catch (err: any) {
    Alert.alert('Print Error', err?.message || 'Could not process printable document.');
  }
}
