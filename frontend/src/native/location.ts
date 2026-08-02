import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

type PermissionResponse = {
  granted: boolean;
  canAskAgain: boolean;
};

export const Accuracy = {
  Balanced: 'balanced',
} as const;

const LOCATION_PERMISSIONS =
  Platform.OS === 'android'
    ? [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]
    : [];

async function requestAndroidPermissions(
  permissions: string[],
): Promise<{ granted: boolean; canAskAgain: boolean }> {
  try {
    const alreadyGranted = await Promise.all(
      permissions.map((p) => PermissionsAndroid.check(p)),
    );
    if (alreadyGranted.every(Boolean)) {
      return { granted: true, canAskAgain: true };
    }

    const results = await PermissionsAndroid.requestMultiple(permissions as any);
    const allGranted = Object.values(results).every(
      (v) => v === PermissionsAndroid.RESULTS.GRANTED,
    );
    const anyNeverAsk = Object.values(results).some(
      (v) => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
    );

    return {
      granted: allGranted,
      canAskAgain: !anyNeverAsk,
    };
  } catch {
    return { granted: false, canAskAgain: true };
  }
}

export async function requestForegroundPermissionsAsync(): Promise<PermissionResponse> {
  if (Platform.OS === 'android') {
    return requestAndroidPermissions(LOCATION_PERMISSIONS);
  }
  return { granted: true, canAskAgain: true };
}

export async function requestBackgroundPermissionsAsync(): Promise<PermissionResponse> {
  if (Platform.OS === 'android') {
    return requestAndroidPermissions([
      ...LOCATION_PERMISSIONS,
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    ]);
  }
  return { granted: true, canAskAgain: true };
}

export async function getCurrentPositionAsync(
  _options?: { accuracy?: string },
): Promise<{ coords: { latitude: number; longitude: number } }> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      },
      (error) => {
        reject(new Error(error.message || 'Could not get location'));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  });
}
