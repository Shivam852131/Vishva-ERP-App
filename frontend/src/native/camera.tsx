import React, { useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Permission = {
  granted: boolean;
  canAskAgain: boolean;
};

type CameraProps = React.ComponentProps<typeof View> & {
  facing?: 'front' | 'back';
  barcodeScannerSettings?: { barcodeTypes?: string[] };
  onBarcodeScanned?: (payload: { data: string }) => void;
};

export type CameraViewHandle = {
  takePictureAsync: (options?: { base64?: boolean; quality?: number }) => Promise<{ base64?: string } | null>;
};

export const CameraView = React.forwardRef<CameraViewHandle, CameraProps>(function CameraView(props, ref) {
  useImperativeHandle(ref, () => ({
    async takePictureAsync() {
      return null;
    },
  }));

  return (
    <View style={[styles.camera, props.style]}>
      <Text style={styles.text}>Camera preview is unavailable in this standard React Native fallback.</Text>
    </View>
  );
});

export function useCameraPermissions(): [Permission, () => Promise<Permission>] {
  const permission = { granted: false, canAskAgain: false };
  return [permission, async () => permission];
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  text: {
    color: '#E5E7EB',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
