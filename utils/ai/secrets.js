const crypto = require('crypto');

function key() {
  const secret = process.env.SESSION_SECRET || process.env.AI_SETTINGS_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is required before API keys can be stored.');
  }
  return crypto.createHash('sha256').update(`mubs-ai:${secret}`).digest();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(payload) {
  if (!payload) return '';
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function mask(plain) {
  if (!plain) return '';
  const tail = plain.slice(-4);
  return `••••${tail}`;
}

module.exports = { encrypt, decrypt, mask };
