import type { APIRoute } from 'astro';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  getAuthEnv,
  signSessionToken,
  verifyPassword,
} from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { passwordHash, sessionSecret } = getAuthEnv();

  if (!passwordHash || !sessionSecret) {
    return new Response(
      JSON.stringify({
        error: 'Dashboard auth is not configured on the server.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let password = '';
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as {
      password?: string;
    };
    password = typeof body.password === 'string' ? body.password : '';
  } else {
    const form = await request.formData().catch(() => null);
    password = String(form?.get('password') ?? '');
  }

  if (!verifyPassword(password, passwordHash)) {
    // Small constant delay to deter brute-force guesses
    await new Promise((r) => setTimeout(r, 400));
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = signSessionToken(sessionSecret);
  cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
