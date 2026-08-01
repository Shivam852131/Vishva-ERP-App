const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getMasterKey() {
  const key = process.env.MASTER_ENCRYPTION_KEY;
  if (!key) throw new Error('MASTER_ENCRYPTION_KEY environment variable is required. Set it in your Render dashboard.');
  return key;
}

function hasMasterKey() {
  return !!process.env.MASTER_ENCRYPTION_KEY;
}

function deriveKey(masterKey, salt) {
  return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

function encrypt(plaintext) {
  const masterKey = getMasterKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(masterKey, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([salt, iv, tag, encrypted]);
  return payload.toString('base64');
}

function decrypt(ciphertextBase64) {
  const masterKey = getMasterKey();
  const payload = Buffer.from(ciphertextBase64, 'base64');

  const salt = payload.subarray(0, SALT_LENGTH);
  const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = payload.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = payload.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(masterKey, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function hashData(data) {
  return crypto.createHmac('sha256', getMasterKey()).update(String(data)).digest('hex');
}

module.exports = { encrypt, decrypt, hashData };
