import { CHUNK_SIZE } from './rtcConfig';

export function fileToBase64(fileUri) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(fileUri);
  });
}

export function splitIntoChunks(base64Data, chunkSize = CHUNK_SIZE) {
  const chunks = [];
  const totalChunks = Math.ceil(base64Data.length / chunkSize);
  for (let i = 0; i < totalChunks; i++) {
    chunks.push(base64Data.slice(i * chunkSize, (i + 1) * chunkSize));
  }
  return chunks;
}

export function getFileExtension(mimeType) {
  const map = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'text/plain': '.txt',
    'application/zip': '.zip',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  };
  return map[mimeType] || '';
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
