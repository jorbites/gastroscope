import type { APIRoute } from 'astro';
import { fetchDashboardSnapshot, parseDateRange } from '../../lib/turso';

export const GET: APIRoute = async ({ url }) => {
  const range = parseDateRange(url.searchParams.get('range'));
  try {
    const snapshot = await fetchDashboardSnapshot(range);
    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=15',
      },
    });
  } catch (err) {
    console.error('Failed loading Gastroscope metrics:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to query analytics database' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
