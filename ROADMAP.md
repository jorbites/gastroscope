# Gastroscope Roadmap

## Phase 1 (Implemented) — Clean Turso Isolation
- Strictly isolated read-only connection to Turso (`daily_*_rollups` & `kafka_offsets`)
- Private HMAC-signed `HttpOnly` session authentication
- Date-range filtering (`7d`, `30d`, `90d`, `all`)
- KPI overview cards with period-over-period delta
- Daily activity trend chart (Page Views vs. Feature Interactions)
- Feature adoption chart & property breakdown (e.g. Bite Cards swipe ratio, Search zero-result rate)
- Conversion funnels (Recipe Creation, Collaborative Drafts, Courses → Certificates)
- Top normalized routes table
- Cookieless audience breakdowns (Device, Locale, Country, Referrer)
- `kafkaroni` Raspberry Pi 3B pipeline health indicator

## Phase 2 — Domain KPIs (Read-Only MongoDB Integration)
- Add an optional, read-only MongoDB Atlas connection (`MONGODB_READONLY_URI`) completely decoupled from the Turso analytics queries:
  - Total users & weekly signups by OAuth provider (Google / GitHub / Email)
  - 2FA adoption rate & push/email notification opt-in rates
  - Published recipes/week, recipe remixes (`forkedFromRecipeId`), cooksnaps per recipe
  - Community health: open vs. solved Quests, Workshops attendance, Top Recipe Voting turnout, Lists/Plannings adoption, Certificates issued per course
  - Cross-reference views vs. cooksnap conversion per cuisine

## Phase 3 — Alerting & Exports
- Optional webhook alert (Discord/Telegram/email) if `kafkaroni` has no offset heartbeat for > 6 hours
- CSV/JSON export for selected date ranges
- Custom funnel builder backed by `daily_prop_rollups`
