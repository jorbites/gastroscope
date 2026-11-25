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

## Deploying to Vercel (GitHub Organization Repo via Vercel CLI)

Because Vercel Hobby does not allow direct Git auto-deploys from GitHub Organization repos, deployment runs via GitHub Actions (`.github/workflows/deploy.yml`) using the Vercel CLI:

1. **Link the project once locally** (creates a gitignored `.vercel/project.json`):
   ```bash
   pnpm dlx vercel@latest login
   pnpm dlx vercel@latest link
   cat .vercel/project.json
   ```
   Copy `orgId` and `projectId` from `.vercel/project.json`.
2. **Create a Vercel token** at [vercel.com/account/tokens](https://vercel.com/account/tokens) (scoped to your personal Hobby account).
3. **Add 3 GitHub Actions secrets** in `github.com/jorbites/gastroscope` → *Settings → Secrets and variables → Actions*:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID` (`orgId` from step 1)
   - `VERCEL_PROJECT_ID` (`projectId` from step 1)
4. **Add the 4 runtime env vars in Vercel** (*Project Settings → Environment Variables → Production*, or push them via `pnpm dlx vercel@latest env add <NAME> production`):
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN` *(read-only token recommended)*
   - `DASHBOARD_PASSWORD_HASH`
   - `SESSION_SECRET`
5. **Push to `main`** (or trigger *Actions → Deploy to Vercel → Run workflow*).

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned Phase 2 features (including optional read-only MongoDB domain KPIs).
