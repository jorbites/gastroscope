import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'gastroscope_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function hashPassword(password: string, salt?: string): string {
  const effectiveSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, effectiveSalt, 64).toString('hex');
  return `${effectiveSalt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) {
    return false;
  }
  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function signSessionToken(secret: string, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1.${exp}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  nowMs = Date.now()
): boolean {
  if (!token || !secret) {
    return false;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  const [version, expStr, providedSig] = parts;
  if (version !== 'v1' || !expStr || !providedSig) {
    return false;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(nowMs / 1000)) {
    return false;
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${version}.${expStr}`)
    .digest('base64url');

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function getAuthEnv(): { passwordHash: string; sessionSecret: string } {
  const passwordHash =
    process.env.DASHBOARD_PASSWORD_HASH ||
    import.meta.env.DASHBOARD_PASSWORD_HASH ||
    '';
  const sessionSecret =
    process.env.SESSION_SECRET || import.meta.env.SESSION_SECRET || '';
  return { passwordHash, sessionSecret };
}
