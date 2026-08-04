import { Platform, Alert, Linking } from 'react-native';
import RNFS from 'react-native-fs';

export type DownloadProgress = {
  bytesWritten: number;
  contentLength: number;
  percentage: number;
};

export type DownloadResult = {
  path: string;
  fileName: string;
  mimeType: string;
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 120);
}

function guessMimeType(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    zip: 'application/zip',
    txt: 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'video/mp4': '.mp4',
  };
  return map[mime] || '';
}

function getDownloadDir(): string {
  if (Platform.OS === 'android') {
    return RNFS.DownloadDirectoryPath || RNFS.CachesDirectoryPath;
  }
  return RNFS.DocumentDirectoryPath;
}

export async function downloadFile(
  url: string,
  fileName?: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<DownloadResult> {
  const mimeType = guessMimeType(url);
  const ext = getExtFromMime(mime) || '.' + (url.split('?')[0].split('.').pop() || 'bin');
  const name = sanitizeFileName(fileName || url.split('/').pop()?.split('?')[0] || `download_${Date.now()}`);
  const finalName = name.endsWith(ext) ? name : `${name}${ext}`;
  const dir = getDownloadDir();
  const destPath = `${dir}/${finalName}`;

  const existing = await RNFS.exists(destPath);
  if (existing) {
    return { path: destPath, fileName: finalName, mimeType };
  }

  const result = RNFS.downloadFile({
    fromUrl: url,
    toFile: destPath,
    progress: onProgress
      ? (res) => {
          onProgress({
            bytesWritten: res.bytesWritten,
            contentLength: res.contentLength,
            percentage: res.contentLength > 0 ? Math.round((res.bytesWritten / res.contentLength) * 100) : 0,
          });
        }
      : undefined,
    connectionTimeout: 15000,
    readTimeout: 30000,
  });

  const res = await result.promise;
  if (res.statusCode === 200 || res.statusCode === 201) {
    return { path: destPath, fileName: finalName, mimeType };
  }
  throw new Error(`Download failed with status ${res.statusCode}`);
}

export async function openFile(path: string): Promise<void> {
  try {
    await Linking.openURL(`file://${path}`);
  } catch {
    Alert.alert('Cannot open file', 'No app found to open this file type.');
  }
}

export async function downloadAndOpen(
  url: string,
  fileName?: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  const result = await downloadFile(url, fileName, onProgress);
  await openFile(result.path);
}

export async function fileExists(path: string): Promise<boolean> {
  return RNFS.exists(path);
}

export async function deleteFile(path: string): Promise<void> {
  const exists = await RNFS.exists(path);
  if (exists) {
    await RNFS.unlink(path);
  }
}
