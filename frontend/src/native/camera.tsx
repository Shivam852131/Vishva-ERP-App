import React, { useImperativeHandle } from 'react';
import { StyleSheet, Text, View, Platform, PermissionsAndroid } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  CameraOptions,
} from 'react-native-image-picker';

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
    async takePictureAsync(options) {
      try {
        const opts: CameraOptions = {
          mediaType: 'photo',
          includeBase64: options?.base64 ?? true,
          quality: (options?.quality as any) ?? 0.5,
          saveToPhotos: false,
          cameraType: 'front',
        };
        const result = await launchCamera(opts);
        if (result.didCancel || result.errorCode || !result.assets?.length) {
          return null;
        }
        const asset = result.assets[0];
        return { base64: asset.base64 || undefined };
      } catch {
        return null;
      }
    },
  }));

  return (
    <View style={[styles.camera, props.style]}>
      <Text style={styles.text}>Camera preview</Text>
    </View>
  );
});

export function useCameraPermissions(): [Permission, () => Promise<Permission>] {
  const request = async (): Promise<Permission> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs camera access for face recognition',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        return { granted: granted === PermissionsAndroid.RESULTS.GRANTED, canAskAgain: granted !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN };
      } catch {
        return { granted: false, canAskAgain: true };
      }
    }
    return { granted: true, canAskAgain: true };
  };

  const permission: Permission = { granted: Platform.OS === 'ios', canAskAgain: true };
  return [permission, request];
}

export { launchCamera, launchImageLibrary };

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
