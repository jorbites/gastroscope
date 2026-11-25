import { createClient, type Client } from '@libsql/client';

export type DateRangeKey = '7d' | '30d' | '90d' | 'all';

export interface DailyPoint {
  day: string;
  pageViews: number;
  interactions: number;
  contentActions: number;
}

export interface FeatureStat {
  name: string;
  category: string;
  count: number;
  props: Array<{ key: string; value: string; count: number }>;
}

export interface PageStat {
  path: string;
  count: number;
  share: number;
}

export interface FunnelStepStat {
  step: string;
  count: number;
  conversionPct: number;
}

export interface FunnelSummary {
  id: string;
  title: string;
  steps: FunnelStepStat[];
}

export interface DimensionItem {
  value: string;
  count: number;
  share: number;
}

export interface PipelineHealth {
  status: 'healthy' | 'stale' | 'empty';
  lastHeartbeatAt: string | null;
  lastEventAt: string | null;
  partitions: Array<{
    topic: string;
    partition: number;
    nextOffset: number;
    updatedAt: string;
  }>;
}

export interface KpiSummary {
  totalEvents: number;
  totalEventsDeltaPct: number | null;
  pageViews: number;
  pageViewsDeltaPct: number | null;
  featureUses: number;
  featureUsesDeltaPct: number | null;
  contentActions: number;
  contentActionsDeltaPct: number | null;
}

export interface DashboardSnapshot {
  range: DateRangeKey;
  generatedAt: string;
  configured: boolean;
  kpis: KpiSummary;
  dailyTrend: DailyPoint[];
  features: FeatureStat[];
  topPages: PageStat[];
  funnels: FunnelSummary[];
  breakdowns: {
    device: DimensionItem[];
    locale: DimensionItem[];
    country: DimensionItem[];
    referrer: DimensionItem[];
  };
  health: PipelineHealth;
}

export function parseDateRange(raw: string | null | undefined): DateRangeKey {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'all') {
    return raw;
  }
  return '30d';
}

export function computeRangeBounds(
  range: DateRangeKey,
  now = new Date()
): { startDay: string | null; prevStartDay: string | null; prevEndDay: string | null } {
  if (range === 'all') {
    return { startDay: null, prevStartDay: null, prevEndDay: null };
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const toIsoDay = (d: Date) => d.toISOString().slice(0, 10);

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1));

  return {
    startDay: toIsoDay(start),
    prevStartDay: toIsoDay(prevStart),
    prevEndDay: toIsoDay(prevEnd),
  };
}

export function calcDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0) {
    return current > 0 ? 100 : null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function getTursoClient(): Client | null {
  const url =
    process.env.TURSO_DATABASE_URL || import.meta.env.TURSO_DATABASE_URL || '';
  const authToken =
    process.env.TURSO_AUTH_TOKEN || import.meta.env.TURSO_AUTH_TOKEN || '';

  if (!url) {
    return null;
  }

  return createClient({
    url,
    authToken: authToken || undefined,
  });
}

function emptySnapshot(range: DateRangeKey, configured: boolean): DashboardSnapshot {
  return {
    range,
    generatedAt: new Date().toISOString(),
    configured,
    kpis: {
      totalEvents: 0,
      totalEventsDeltaPct: null,
      pageViews: 0,
      pageViewsDeltaPct: null,
      featureUses: 0,
      featureUsesDeltaPct: null,
      contentActions: 0,
      contentActionsDeltaPct: null,
    },
    dailyTrend: [],
    features: [],
    topPages: [],
    funnels: [],
    breakdowns: {
      device: [],
      locale: [],
      country: [],
      referrer: [],
    },
    health: {
      status: 'empty',
      lastHeartbeatAt: null,
      lastEventAt: null,
      partitions: [],
    },
  };
}

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchDashboardSnapshot(
  range: DateRangeKey,
  clientOverride?: Client
): Promise<DashboardSnapshot> {
  const client = clientOverride ?? getTursoClient();
  if (!client) {
    return emptySnapshot(range, false);
  }

  const { startDay, prevStartDay, prevEndDay } = computeRangeBounds(range);
  const whereDay = startDay ? 'WHERE day >= ?' : '';
  const dayArgs = startDay ? [startDay] : [];

  try {
    const [
      eventRows,
      prevEventRows,
      pageRows,
      propRows,
      dimRows,
      offsetRows,
    ] = await Promise.all([
      client.execute({
        sql: `SELECT day, category, name, count FROM daily_event_rollups ${whereDay} ORDER BY day ASC`,
        args: dayArgs,
      }),
      prevStartDay && prevEndDay
        ? client.execute({
            sql: `SELECT category, name, SUM(count) AS total FROM daily_event_rollups WHERE day >= ? AND day <= ? GROUP BY category, name`,
            args: [prevStartDay, prevEndDay],
          })
        : Promise.resolve({ rows: [] }),
      client.execute({
        sql: `SELECT path, SUM(count) AS total FROM daily_page_rollups ${whereDay} GROUP BY path ORDER BY total DESC LIMIT 20`,
        args: dayArgs,
      }),
      client.execute({
        sql: `SELECT event_name, prop_key, prop_value, SUM(count) AS total FROM daily_prop_rollups ${whereDay} GROUP BY event_name, prop_key, prop_value ORDER BY total DESC`,
        args: dayArgs,
      }),
      client.execute({
        sql: `SELECT dimension, value, SUM(count) AS total FROM daily_dimension_rollups ${whereDay} GROUP BY dimension, value ORDER BY total DESC`,
        args: dayArgs,
      }),
      client.execute({
        sql: `SELECT topic, partition, next_offset, last_event_ts, updated_at FROM kafka_offsets ORDER BY partition ASC`,
        args: [],
      }),
    ]);

    // 1. Aggregate daily trends & KPI totals
    const byDay = new Map<string, DailyPoint>();
    const featureMap = new Map<string, FeatureStat>();
    let totalEvents = 0;
    let pageViews = 0;
    let featureUses = 0;
    let contentActions = 0;

    for (const row of eventRows.rows) {
      const day = String(row.day);
      const category = String(row.category);
      const name = String(row.name);
      const count = toNumber(row.count);

      totalEvents += count;

      const point = byDay.get(day) ?? {
        day,
        pageViews: 0,
        interactions: 0,
        contentActions: 0,
      };

      if (category === 'page') {
        pageViews += count;
        point.pageViews += count;
      } else if (category === 'content') {
        contentActions += count;
        point.contentActions += count;
      } else {
        featureUses += count;
        point.interactions += count;
      }
      byDay.set(day, point);

      if (category !== 'page') {
        const existing = featureMap.get(name) ?? {
          name,
          category,
          count: 0,
          props: [],
        };
        existing.count += count;
        featureMap.set(name, existing);
      }
    }

    // Previous period totals for delta %
    let prevTotal = 0;
    let prevPages = 0;
    let prevFeatures = 0;
    let prevContent = 0;
    for (const row of prevEventRows.rows) {
      const category = String(row.category);
      const total = toNumber(row.total);
      prevTotal += total;
      if (category === 'page') prevPages += total;
      else if (category === 'content') prevContent += total;
      else prevFeatures += total;
    }

    // 2. Attach prop breakdowns & build funnels
    const funnelCounts = new Map<string, Map<string, number>>();
    for (const row of propRows.rows) {
      const eventName = String(row.event_name);
      const propKey = String(row.prop_key);
      const propValue = String(row.prop_value);
      const total = toNumber(row.total);

      const feat = featureMap.get(eventName);
      if (feat && feat.props.length < 12) {
        feat.props.push({ key: propKey, value: propValue, count: total });
      }

      if (propKey === 'step') {
        const stepMap = funnelCounts.get(eventName) ?? new Map<string, number>();
        stepMap.set(propValue, (stepMap.get(propValue) ?? 0) + total);
        funnelCounts.set(eventName, stepMap);
      }
    }

    const features = Array.from(featureMap.values()).sort(
      (a, b) => b.count - a.count
    );

    // 3. Top pages
    const totalPageViews = pageRows.rows.reduce(
      (acc, r) => acc + toNumber(r.total),
      0
    );
    const topPages: PageStat[] = pageRows.rows.map((row) => {
      const count = toNumber(row.total);
      return {
        path: String(row.path),
        count,
        share:
          totalPageViews > 0 ? Math.round((count / totalPageViews) * 100) : 0,
      };
    });

    // 4. Funnels
    const funnelDefs: Array<{ id: string; title: string; steps: string[] }> = [
      {
        id: 'recipe_create_step',
        title: 'Recipe Creation Funnel',
        steps: ['modal_open', 'draft_saved', 'published'],
      },
      {
        id: 'collab_draft_step',
        title: 'Collaborative Draft Funnel',
        steps: ['invite_opened', 'link_copied', 'joined'],
      },
      {
        id: 'course_step',
        title: 'Course Completion Funnel',
        steps: ['started', 'test_passed', 'cert_shared'],
      },
    ];

    const funnels: FunnelSummary[] = funnelDefs.map((def) => {
      const map = funnelCounts.get(def.id) ?? new Map<string, number>();
      const firstCount = map.get(def.steps[0]) ?? 0;
      return {
        id: def.id,
        title: def.title,
        steps: def.steps.map((step, idx) => {
          const count = map.get(step) ?? 0;
          const conversionPct =
            idx === 0
              ? count > 0
                ? 100
                : 0
              : firstCount > 0
                ? Math.min(100, Math.round((count / firstCount) * 100))
                : 0;
          return { step, count, conversionPct };
        }),
      };
    });

    // 5. Audience breakdowns
    const rawDims: Record<string, Array<{ value: string; count: number }>> = {
      device: [],
      locale: [],
      country: [],
      referrer: [],
    };
    for (const row of dimRows.rows) {
      const dim = String(row.dimension);
      if (dim in rawDims) {
        rawDims[dim].push({
          value: String(row.value),
          count: toNumber(row.total),
        });
      }
    }

    const toBreakdown = (
      items: Array<{ value: string; count: number }>
    ): DimensionItem[] => {
      const sum = items.reduce((a, b) => a + b.count, 0);
      return items.slice(0, 8).map((item) => ({
        value: item.value,
        count: item.count,
        share: sum > 0 ? Math.round((item.count / sum) * 100) : 0,
      }));
    };

    // 6. Kafkaroni RPi pipeline health
    const partitions = offsetRows.rows.map((r) => ({
      topic: String(r.topic),
      partition: toNumber(r.partition),
      nextOffset: toNumber(r.next_offset),
      updatedAt: String(r.updated_at),
      lastEventTs: r.last_event_ts ? String(r.last_event_ts) : null,
    }));

    let lastHeartbeatAt: string | null = null;
    let lastEventAt: string | null = null;
    for (const p of partitions) {
      if (!lastHeartbeatAt || p.updatedAt > lastHeartbeatAt) {
        lastHeartbeatAt = p.updatedAt;
      }
      if (p.lastEventTs && (!lastEventAt || p.lastEventTs > lastEventAt)) {
        lastEventAt = p.lastEventTs;
      }
    }

    let status: PipelineHealth['status'] = 'empty';
    if (lastHeartbeatAt) {
      const ageMs = Date.now() - Date.parse(lastHeartbeatAt);
      status = ageMs <= 24 * 60 * 60 * 1000 ? 'healthy' : 'stale';
    }

    return {
      range,
      generatedAt: new Date().toISOString(),
      configured: true,
      kpis: {
        totalEvents,
        totalEventsDeltaPct:
          range === 'all' ? null : calcDeltaPct(totalEvents, prevTotal),
        pageViews,
        pageViewsDeltaPct:
          range === 'all' ? null : calcDeltaPct(pageViews, prevPages),
        featureUses,
        featureUsesDeltaPct:
          range === 'all' ? null : calcDeltaPct(featureUses, prevFeatures),
        contentActions,
        contentActionsDeltaPct:
          range === 'all' ? null : calcDeltaPct(contentActions, prevContent),
      },
      dailyTrend: Array.from(byDay.values()),
      features,
      topPages,
      funnels,
      breakdowns: {
        device: toBreakdown(rawDims.device),
        locale: toBreakdown(rawDims.locale),
        country: toBreakdown(rawDims.country),
        referrer: toBreakdown(rawDims.referrer),
      },
      health: {
        status,
        lastHeartbeatAt,
        lastEventAt,
        partitions: partitions.map(({ topic, partition, nextOffset, updatedAt }) => ({
          topic,
          partition,
          nextOffset,
          updatedAt,
        })),
      },
    };
  } catch (err) {
    // Tables may not exist yet before kafkaroni's first run
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('no such table')) {
      return emptySnapshot(range, true);
    }
    throw err;
  }
}
