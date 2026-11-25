import { defineMiddleware } from 'astro:middleware';
import {
  SESSION_COOKIE_NAME,
  getAuthEnv,
  verifySessionToken,
} from './lib/auth';

const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/api/auth/logout']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/_astro/') ||
    pathname === '/favicon.svg' ||
    pathname === '/favicon.ico'
  ) {
    return next();
  }

  const { sessionSecret } = getAuthEnv();
  const cookie = context.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!verifySessionToken(cookie, sessionSecret)) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return context.redirect('/login');
  }

  return next();
});
