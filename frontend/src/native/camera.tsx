import React, { useImperativeHandle, useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, Platform, PermissionsAndroid } from 'react-native';
import {
  Camera,
  type CameraRef,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  useObjectOutput,
} from 'react-native-vision-camera';
import {
  launchCamera,
  launchImageLibrary,
  type CameraOptions,
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
  takePictureAsync: (options?: {
    base64?: boolean;
    quality?: number;
  }) => Promise<{ base64?: string } | null>;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export const CameraView = React.forwardRef<CameraViewHandle, CameraProps>(
  function CameraView(
    { facing, barcodeScannerSettings, onBarcodeScanned, style, children, ...viewProps },
    ref,
  ) {
    const cameraRef = useRef<CameraRef>(null);
    const device = useCameraDevice(facing === 'front' ? 'front' : 'back');
    const { hasPermission, requestPermission } = useCameraPermission();

    const photoOutput = usePhotoOutput();

    const onObjectsScannedRef = useRef(onBarcodeScanned);
    onObjectsScannedRef.current = onBarcodeScanned;

    const objectOutput = useObjectOutput({
      types: ['qr'],
      onObjectsScanned: (objects) => {
        if (objects.length > 0 && onObjectsScannedRef.current) {
          const obj = objects[0] as any;
          if (obj.value) {
            onObjectsScannedRef.current({ data: obj.value });
          }
        }
      },
    });

    useEffect(() => {
      if (!hasPermission) {
        requestPermission();
      }
    }, [hasPermission, requestPermission]);

    useImperativeHandle(ref, () => ({
      async takePictureAsync(options) {
        if (device && photoOutput) {
          try {
            const photo = await photoOutput.capturePhoto(
              { flashMode: 'off' },
              {},
            );
            const data = await photo.getFileDataAsync();
            photo.dispose();
            if (options?.base64 !== false) {
              return { base64: arrayBufferToBase64(data) };
            }
            return {};
          } catch {
            // Fall back to image-picker
          }
        }
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

    if (!device) {
      return (
        <View style={[styles.camera, style]}>
          <Text style={styles.text}>Camera preview</Text>
        </View>
      );
    }

    return (
      <View style={style}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          outputs={[photoOutput, objectOutput]}
        />
      </View>
    );
  },
);

export function useCameraPermissions(): [Permission, () => Promise<Permission>] {
  const [permission, setPermission] = useState<Permission>({
    granted: false,
    canAskAgain: true,
  });

  useEffect(() => {
    if (Platform.OS === 'android') {
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA).then((granted) => {
        setPermission({ granted, canAskAgain: true });
      });
    }
  }, []);

  const request = async (): Promise<Permission> => {
    if (Platform.OS === 'android') {
      try {
        const alreadyGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        if (alreadyGranted) {
          const next: Permission = { granted: true, canAskAgain: true };
          setPermission(next);
          return next;
        }

        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs camera access for face recognition',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );

        if (result === undefined || result === null) {
          const checkAgain = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.CAMERA,
          );
          const next: Permission = { granted: checkAgain, canAskAgain: checkAgain };
          setPermission(next);
          return next;
        }

        const next: Permission = {
          granted: result === PermissionsAndroid.RESULTS.GRANTED,
          canAskAgain: result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        };
        setPermission(next);
        return next;
      } catch {
        const next: Permission = { granted: false, canAskAgain: true };
        setPermission(next);
        return next;
      }
    }
    const next: Permission = { granted: true, canAskAgain: true };
    setPermission(next);
    return next;
  };

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
