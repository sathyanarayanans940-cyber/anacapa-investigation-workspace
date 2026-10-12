import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  pbkdf2,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(pbkdf2);
export const iterations = 600000;
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const digest = (value) => sha256(JSON.stringify(value));
export const mac = (key, value) =>
  createHmac('sha256', key).update(JSON.stringify(value)).digest('hex');
export function equal(a, b) {
  const x = Buffer.from(a || ''),
    y = Buffer.from(b || '');
  return x.length === y.length && timingSafeEqual(x, y);
}
export function encrypt(bytes, key, context) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(bytes), cipher.final(), cipher.getAuthTag()]);
  return { algorithm: 'AES-256-GCM', iv: iv.toString('base64'), data: data.toString('base64') };
}
export function decrypt(value, key, context) {
  if (
    value?.algorithm !== 'AES-256-GCM' ||
    typeof value.iv !== 'string' ||
    typeof value.data !== 'string'
  )
    throw Error('Invalid encrypted record.');
  const iv = Buffer.from(value.iv, 'base64'),
    data = Buffer.from(value.data, 'base64');
  if (iv.length !== 12 || data.length < 16) throw Error('Invalid encrypted record.');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]);
}
export async function passwordKey(password, salt) {
  if (typeof password !== 'string' || password.length > 1024) throw Error('Invalid passphrase.');
  if (Buffer.from(salt, 'base64').length !== 32) throw Error('Invalid key settings.');
  return derive(password, Buffer.from(salt, 'base64'), iterations, 32, 'sha256');
}
export function requirePassphrase(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024)
    throw Error('Use a passphrase of at least 12 characters. There is no password recovery.');
}
export async function sealPackage(bundle, password) {
  requirePassphrase(password);
  const salt = randomBytes(32).toString('base64'),
    key = await passwordKey(password, salt);
  try {
    return {
      format: 'anacapa-encrypted',
      version: 1,
      kdf: 'PBKDF2-SHA256',
      iterations,
      salt,
      ...encrypt(Buffer.from(JSON.stringify(bundle)), key, 'anacapa-portable-v1'),
    };
  } finally {
    key.fill(0);
  }
}
export async function openPackage(envelope, password) {
  if (
    envelope?.format !== 'anacapa-encrypted' ||
    envelope.version !== 1 ||
    envelope.kdf !== 'PBKDF2-SHA256' ||
    envelope.iterations !== iterations
  )
    throw Error('Unsupported encrypted investigation.');
  const key = await passwordKey(password, envelope.salt);
  try {
    return JSON.parse(decrypt(envelope, key, 'anacapa-portable-v1'));
  } catch {
    throw Error('Wrong passphrase or damaged investigation.');
  } finally {
    key.fill(0);
  }
}
