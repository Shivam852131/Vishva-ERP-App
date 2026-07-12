type PickerAsset = {
  base64?: string;
};

type PickerResult = {
  canceled: boolean;
  assets?: PickerAsset[];
};

export async function requestCameraPermissionsAsync() {
  return { granted: false, canAskAgain: false };
}

export async function launchCameraAsync(
  _options?: Record<string, unknown>,
): Promise<PickerResult> {
  return { canceled: true, assets: [] };
}

export async function launchImageLibraryAsync(
  _options?: Record<string, unknown>,
): Promise<PickerResult> {
  return { canceled: true, assets: [] };
}
