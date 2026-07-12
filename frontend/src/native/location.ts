type PermissionResponse = {
  granted: boolean;
  canAskAgain: boolean;
};

export const Accuracy = {
  Balanced: 'balanced',
} as const;

export async function requestForegroundPermissionsAsync(): Promise<PermissionResponse> {
  return { granted: false, canAskAgain: false };
}

export async function requestBackgroundPermissionsAsync(): Promise<PermissionResponse> {
  return { granted: false, canAskAgain: false };
}

export async function getCurrentPositionAsync(
  _options?: { accuracy?: string },
): Promise<{ coords: { latitude: number; longitude: number } }> {
  throw new Error('Location services are not configured for this standard React Native build yet.');
}
