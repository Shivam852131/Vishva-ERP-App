import { launchCamera, launchImageLibrary, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import { Platform, PermissionsAndroid } from 'react-native';

type PickerAsset = {
  base64?: string;
  uri?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  type?: string;
  fileName?: string;
};

type PickerResult = {
  canceled: boolean;
  assets?: PickerAsset[];
};

export async function requestCameraPermissionsAsync(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'This app needs camera access to take photos',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return {
        granted: granted === PermissionsAndroid.RESULTS.GRANTED,
        canAskAgain: granted !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      };
    } catch {
      return { granted: false, canAskAgain: true };
    }
  }
  return { granted: true, canAskAgain: true };
}

export async function launchCameraAsync(
  options?: Record<string, unknown>,
): Promise<PickerResult> {
  try {
    const baseOpts: CameraOptions = {
      mediaType: 'photo',
      includeBase64: true,
      quality: 0.5,
      saveToPhotos: false,
    };
    const merged = { ...baseOpts, ...options } as CameraOptions;
    const result = await launchCamera(merged);
    if (result.didCancel || result.errorCode || !result.assets?.length) {
      return { canceled: true, assets: [] };
    }
    return {
      canceled: false,
      assets: result.assets.map(a => ({
        base64: a.base64 || undefined,
        uri: a.uri,
        width: a.width,
        height: a.height,
        fileSize: a.fileSize,
        type: a.type,
        fileName: a.fileName,
      })),
    };
  } catch {
    return { canceled: true, assets: [] };
  }
}

export async function launchImageLibraryAsync(
  options?: Record<string, unknown>,
): Promise<PickerResult> {
  try {
    const baseOpts: ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: true,
      quality: 0.5,
    };
    const merged = { ...baseOpts, ...options } as ImageLibraryOptions;
    const result = await launchImageLibrary(merged);
    if (result.didCancel || result.errorCode || !result.assets?.length) {
      return { canceled: true, assets: [] };
    }
    return {
      canceled: false,
      assets: result.assets.map(a => ({
        base64: a.base64 || undefined,
        uri: a.uri,
        width: a.width,
        height: a.height,
        fileSize: a.fileSize,
        type: a.type,
        fileName: a.fileName,
      })),
    };
  } catch {
    return { canceled: true, assets: [] };
  }
}
