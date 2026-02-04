import type { Env, NetworkState, NetworkGoal } from './types';
import { runPipeline } from './pipeline';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // POST /api/network/goal — admin-only goal management
    if (request.method === 'POST' && url.pathname === '/api/network/goal') {
      if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 16) {
        return jsonResponse({ error: 'ADMIN_TOKEN not configured' }, 500, corsHeaders);
      }

      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
      }

      const body = await request.json() as NetworkGoal;
      if (
        !body.id || !body.name || !body.description || !body.metric ||
        typeof body.weight !== 'number' || body.weight < 0 || body.weight > 1 ||
        typeof body.startedAt !== 'number'
      ) {
        return jsonResponse({ error: 'Invalid goal: requires id, name, description, metric, weight (0-1), startedAt' }, 400, corsHeaders);
      }

      await env.NETWORK_KV.put('network:goal', JSON.stringify(body));
      return jsonResponse({ status: 'Goal saved', goal: body }, 200, corsHeaders);
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
