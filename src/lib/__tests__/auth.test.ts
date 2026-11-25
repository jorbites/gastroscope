import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../auth';

describe('Gastroscope auth helpers', () => {
  it('verifies scrypt password hashes in constant time', () => {
    const hash = hashPassword('super-secret-avocado');
    expect(verifyPassword('super-secret-avocado', hash)).toBe(true);
    expect(verifyPassword('wrong-password', hash)).toBe(false);
    expect(verifyPassword('super-secret-avocado', 'malformed')).toBe(false);
  });

  it('signs and validates HMAC session tokens with expiry', () => {
    const secret = 'test-session-secret-0123456789';
    const now = 1_795_000_000_000;
    const token = signSessionToken(secret, now);

    expect(verifySessionToken(token, secret, now + 1000)).toBe(true);
    expect(verifySessionToken(token, 'different-secret', now + 1000)).toBe(
      false
    );
    expect(verifySessionToken(`${token}tampered`, secret, now + 1000)).toBe(
      false
    );
    // Expired after 8 days
    expect(
      verifySessionToken(token, secret, now + 8 * 24 * 60 * 60 * 1000)
    ).toBe(false);
  });
});
