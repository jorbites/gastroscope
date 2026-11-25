import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Cpu,
  Eye,
  Flame,
  Globe,
  LogOut,
  RefreshCw,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DashboardSnapshot,
  DateRangeKey,
  DimensionItem,
  FeatureStat,
} from '../lib/turso';

interface DashboardAppProps {
  initialSnapshot: DashboardSnapshot;
}

const RANGES: Array<{ key: DateRangeKey; label: string }> = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All' },
];

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatEventLabel(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'No events yet';
  const diffSec = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function KpiCard({
  title,
  value,
  deltaPct,
  icon,
}: {
  title: string;
  value: number;
  deltaPct: number | null;
  icon: React.ReactNode;
}) {
  const deltaColor =
    deltaPct === null
      ? 'text-neutral-500'
      : deltaPct >= 0
        ? 'text-avocado-400'
        : 'text-rose-400';

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/60 p-5">
      <div className="mb-3 flex items-center justify-between text-neutral-400">
        <span className="text-xs font-medium uppercase tracking-wider">
          {title}
        </span>
        {icon}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold tracking-tight text-white">
          {formatNumber(value)}
        </span>
        {deltaPct !== null && (
          <span className={`text-xs font-semibold ${deltaColor}`}>
            {deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`}
          </span>
        )}
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: DimensionItem[];
}) {
  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/60 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
        {icon}
        <span>{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-neutral-500">No data in this range</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.value} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-neutral-200">{item.value}</span>
                <span className="font-mono text-neutral-400">
                  {formatNumber(item.count)} ({item.share}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-avocado-500/80"
                  style={{ width: `${Math.max(item.share, 2)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DashboardApp({ initialSnapshot }: DashboardAppProps) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(initialSnapshot);
  const [selectedRange, setSelectedRange] = useState<DateRangeKey>(
    initialSnapshot.range
  );
  const [selectedFeature, setSelectedFeature] = useState<FeatureStat | null>(
    initialSnapshot.features[0] ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRange(range: DateRangeKey) {
    setSelectedRange(range);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics?range=${range}`);
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        throw new Error('Failed fetching metrics');
      }
      const next = (await res.json()) as DashboardSnapshot;
      setSnapshot(next);
      setSelectedFeature(next.features[0] ?? null);
    } catch {
      setError('Unable to refresh metrics from Turso.');
    } finally {
      setLoading(false);
    }
  }

  const healthStyles =
    snapshot.health.status === 'healthy'
      ? 'border-avocado-500/30 bg-avocado-500/10 text-avocado-400'
      : snapshot.health.status === 'stale'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        : 'border-neutral-700 bg-neutral-800/60 text-neutral-400';

  const topFeaturesChart = snapshot.features.slice(0, 10).map((f) => ({
    label: formatEventLabel(f.name),
    count: f.count,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 border-b border-neutral-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-avocado-500/15 text-lg font-bold text-avocado-400">
            G
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Gastroscope
            </h1>
            <p className="text-xs text-neutral-400">
              Cookieless Jorbites Interaction Analytics · Turso Isolated
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Kafkaroni RPi Health Pill */}
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${healthStyles}`}
            title="Kafkaroni Raspberry Pi 3B consumer heartbeat"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>
              Kafkaroni:{' '}
              {snapshot.health.status === 'healthy'
                ? `Synced ${formatRelativeTime(snapshot.health.lastHeartbeatAt)}`
                : snapshot.health.status === 'stale'
                  ? `Stale (${formatRelativeTime(snapshot.health.lastHeartbeatAt)})`
                  : 'Awaiting events'}
            </span>
          </div>

          {/* Date Range Switcher */}
          <div className="inline-flex rounded-xl border border-neutral-800 bg-neutral-900 p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => loadRange(r.key)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  selectedRange === r.key
                    ? 'bg-avocado-500 text-neutral-950'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadRange(selectedRange)}
            disabled={loading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <form method="POST" action="/api/auth/logout">
            <button
              type="submit"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:border-neutral-700 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </form>
        </div>
      </header>

      {!snapshot.configured && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <strong>Turso not configured yet:</strong> set{' '}
          <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs">
            TURSO_DATABASE_URL
          </code>{' '}
          and{' '}
          <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs">
            TURSO_AUTH_TOKEN
          </code>{' '}
          to start visualizing live rollups from Kafkaroni.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Events"
          value={snapshot.kpis.totalEvents}
          deltaPct={snapshot.kpis.totalEventsDeltaPct}
          icon={<Activity className="h-4 w-4 text-avocado-400" />}
        />
        <KpiCard
          title="Page Views"
          value={snapshot.kpis.pageViews}
          deltaPct={snapshot.kpis.pageViewsDeltaPct}
          icon={<Eye className="h-4 w-4 text-sky-400" />}
        />
        <KpiCard
          title="Feature Interactions"
          value={snapshot.kpis.featureUses}
          deltaPct={snapshot.kpis.featureUsesDeltaPct}
          icon={<Sparkles className="h-4 w-4 text-amber-400" />}
        />
        <KpiCard
          title="Content Actions"
          value={snapshot.kpis.contentActions}
          deltaPct={snapshot.kpis.contentActionsDeltaPct}
          icon={<Flame className="h-4 w-4 text-rose-400" />}
        />
      </section>

      {/* Daily Trend Chart */}
      <section className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Daily Activity</h2>
            <p className="text-xs text-neutral-400">
              Page views vs. feature &amp; discovery interactions
            </p>
          </div>
        </div>
        <div className="h-72 w-full">
          {snapshot.dailyTrend.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-neutral-500">
              No activity recorded in this range yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={snapshot.dailyTrend}>
                <defs>
                  <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="intGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis
                  dataKey="day"
                  stroke="#737373"
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="#737373" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#171717',
                    borderColor: '#262626',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="pageViews"
                  name="Page Views"
                  stroke="#38bdf8"
                  fill="url(#pvGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="interactions"
                  name="Feature Interactions"
                  stroke="#4ade80"
                  fill="url(#intGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Feature Adoption + Property Drilldown */}
      <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/60 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <BarChart3 className="h-4 w-4 text-avocado-400" />
            <span>Top Feature Usage</span>
          </div>
          <div className="h-72 w-full">
            {topFeaturesChart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                No feature events in this range yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topFeaturesChart}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis type="number" stroke="#737373" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={150}
                    stroke="#a3a3a3"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#171717',
                      borderColor: '#262626',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Events"
                    fill="#4ade80"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">
            Feature Property Breakdown
          </h2>
          {snapshot.features.length === 0 ? (
            <p className="text-xs text-neutral-500">No features tracked yet.</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {snapshot.features.slice(0, 12).map((feat) => (
                  <button
                    key={feat.name}
                    type="button"
                    onClick={() => setSelectedFeature(feat)}
                    className={`cursor-pointer rounded-lg px-2 py-1 text-xs transition ${
                      selectedFeature?.name === feat.name
                        ? 'bg-avocado-500 font-semibold text-neutral-950'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {formatEventLabel(feat.name)}
                  </button>
                ))}
              </div>
              {selectedFeature && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-xs text-neutral-400">
                    <span>{selectedFeature.category}</span>
                    <span className="font-mono text-white">
                      {formatNumber(selectedFeature.count)} total
                    </span>
                  </div>
                  {selectedFeature.props.length === 0 ? (
                    <p className="text-xs text-neutral-500">
                      No property dimensions for this event.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {selectedFeature.props.map((p) => (
                        <li
                          key={`${p.key}:${p.value}`}
                          className="flex items-center justify-between rounded-lg bg-neutral-950/60 px-2.5 py-1.5 text-xs"
                        >
                          <span className="text-neutral-300">
                            <span className="text-neutral-500">{p.key}=</span>
                            {p.value}
                          </span>
                          <span className="font-mono text-avocado-400">
                            {formatNumber(p.count)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Conversion Funnels */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {snapshot.funnels.map((funnel) => (
          <div
            key={funnel.id}
            className="rounded-2xl border border-neutral-800/80 bg-neutral-900/60 p-5"
          >
            <h3 className="mb-4 text-sm font-semibold text-white">
              {funnel.title}
            </h3>
            <div className="space-y-3">
              {funnel.steps.map((s) => (
                <div key={s.step} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300">
                      {formatEventLabel(s.step)}
                    </span>
                    <span className="font-mono text-neutral-400">
                      {formatNumber(s.count)} ({s.conversionPct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-avocado-500"
                      style={{ width: `${s.conversionPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Top Pages & Cookieless Audience Breakdowns */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/60 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">
            Top Normalized Routes
          </h2>
          {snapshot.topPages.length === 0 ? (
            <p className="text-xs text-neutral-500">No page views yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {snapshot.topPages.map((page) => (
                <li key={page.path} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-mono text-neutral-200">
                      {page.path}
                    </span>
                    <span className="font-mono text-neutral-400">
                      {formatNumber(page.count)} ({page.share}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-sky-400/80"
                      style={{ width: `${Math.max(page.share, 2)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
          <BreakdownCard
            title="Device Class"
            icon={<Smartphone className="h-4 w-4 text-avocado-400" />}
            items={snapshot.breakdowns.device}
          />
          <BreakdownCard
            title="Language"
            icon={<Globe className="h-4 w-4 text-sky-400" />}
            items={snapshot.breakdowns.locale}
          />
          <BreakdownCard
            title="Country"
            icon={<Globe className="h-4 w-4 text-amber-400" />}
            items={snapshot.breakdowns.country}
          />
          <BreakdownCard
            title="Referrers"
            icon={<Activity className="h-4 w-4 text-purple-400" />}
            items={snapshot.breakdowns.referrer}
          />
        </div>
      </section>
    </div>
  );
}
