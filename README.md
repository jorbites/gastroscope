# Gastroscope

Private, cookieless analytics dashboard for **Jorbites**, built with **Astro 7 (SSR)**, **React**, **Tailwind CSS v4**, **Recharts**, and **Turso (`@libsql/client`)**.

## Architecture

- Reads **exclusively** from the isolated Turso analytics database populated by [`kafkaroni`](../kafkaroni) (pre-aggregated `daily_*_rollups` & `kafka_offsets` tables for sub-millisecond reads and minimal Turso row-read usage).
- Protected by Astro middleware (`src/middleware.ts`) using scrypt password verification and an HMAC-SHA256 `HttpOnly` session cookie.
- Zero public routes besides `/login` (`noindex, nofollow`).

## Setup

```bash
pnpm install
cp .env.example .env
```

Generate your admin password hash and session secret:

```bash
node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');const h=c.scryptSync(process.argv[1],s,64).toString('hex');console.log('DASHBOARD_PASSWORD_HASH='+s+':'+h)" "your-strong-password"
node -e "console.log('SESSION_SECRET='+require('crypto').randomBytes(32).toString('hex'))"
```

Run locally:

```bash
pnpm dev
pnpm test
pnpm build
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned Phase 2 features (including optional read-only MongoDB domain KPIs).
