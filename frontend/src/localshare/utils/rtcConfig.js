export const RTC_CONFIG = {
  iceServers: [],
};

export const CHUNK_SIZE = 64 * 1024;
export const BRIDGE_CHUNK_SIZE = 32 * 1024;
export const DATA_CHANNEL_LABEL = 'localshare-file-transfer';
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;

export const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
  'application/zip',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export const FILE_EXTENSIONS = {
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
