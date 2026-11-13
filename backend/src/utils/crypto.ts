import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-cbc';

/** Cifra con AES-256-CBC usando un IV aleatorio de 16 bytes por registro. */
export function encryptData(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, env.encryptionKey, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
  };
}

/** Descifra un valor guardado; solo se llama cuando el dueño pide ver o copiar el secreto. */
export function decryptData(encryptedData: string, ivHex: string) {
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, env.encryptionKey, iv);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
