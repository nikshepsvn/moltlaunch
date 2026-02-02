import type { Env, NetworkState } from './types';
import { runPipeline } from './pipeline';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    // GET /api/network — full cached state
    if (url.pathname === '/api/network') {
      const cached = await env.NETWORK_KV.get('network:state');
      if (!cached) {
        return jsonResponse({ error: 'No data yet — pipeline has not run' }, 503, corsHeaders);
      }
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // GET /api/network/swaps?since=<timestamp> — incremental swaps
    if (url.pathname === '/api/network/swaps') {
      const sinceParam = url.searchParams.get('since');
      const since = sinceParam ? Number(sinceParam) : 0;

      const cached = await env.NETWORK_KV.get('network:state');
      if (!cached) {
        return jsonResponse({ error: 'No data yet' }, 503, corsHeaders);
      }

      const state = JSON.parse(cached) as NetworkState;
      const sinceSeconds = since / 1000;
      const newSwaps = since > 0
        ? state.swaps.filter((s) => s.timestamp > sinceSeconds)
        : state.swaps;

      return jsonResponse({
        swaps: newSwaps,
        timestamp: state.timestamp,
      }, 200, corsHeaders);
    }

    // GET /api/network/trigger — manual pipeline trigger (for dev/testing)
    if (url.pathname === '/api/network/trigger') {
      ctx.waitUntil(runPipeline(env));
      return jsonResponse({ status: 'Pipeline triggered' }, 200, corsHeaders);
    }

    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  },

  // Cron trigger: runs every 2 minutes
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runPipeline(env));
  },
};

function jsonResponse(
  data: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
