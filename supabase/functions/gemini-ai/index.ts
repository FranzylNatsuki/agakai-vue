import { withSupabase } from 'npm:@supabase/server@1.9.2';
import {
  forwardGeminiResponse,
  geminiEndpointUrl,
  geminiModelCandidates,
} from '../_shared/geminiProxy.ts';

const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_OUTPUT_TOKENS = 1536;
const MAX_REQUESTS_PER_MINUTE = 20;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const current = requestWindows.get(userId);
  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(userId, { startedAt: now, count: 1 });
    if (requestWindows.size > 2_000) {
      for (const [id, window] of requestWindows) {
        if (now - window.startedAt >= 60_000) requestWindows.delete(id);
      }
    }
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_MINUTE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function capOutputTokens(payload: Record<string, unknown>): Record<string, unknown> {
  const generationConfig = isRecord(payload.generationConfig) ? payload.generationConfig : {};
  const requested = Number(generationConfig.maxOutputTokens);
  const maxOutputTokens = Number.isFinite(requested) && requested > 0
    ? Math.min(Math.floor(requested), MAX_OUTPUT_TOKENS)
    : MAX_OUTPUT_TOKENS;
  return {
    ...payload,
    generationConfig: { ...generationConfig, maxOutputTokens },
  };
}

const handler = withSupabase({ auth: 'user' }, async (request, context) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const userId = context.userClaims?.id;
  if (!userId) return json({ error: 'Sign in is required.' }, 401);
  if (rateLimited(userId)) return json({ error: 'Please wait before trying again.' }, 429);

  const operation = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
  if (operation !== 'generate' && operation !== 'stream') {
    return json({ error: 'Unknown Gemini operation.' }, 404);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'AI service is not configured.' }, 503);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) return json({ error: 'Request is too large.' }, 413);

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      return json({ error: 'Request is too large.' }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'A valid AI request is required.' }, 400);
  }
  if (!isRecord(body) || !isRecord(body.payload) || !Array.isArray(body.payload.contents)) {
    return json({ error: 'A valid AI request is required.' }, 400);
  }

  const payload = capOutputTokens(body.payload);
  const streaming = operation === 'stream';
  let lastStatus = 502;
  const configuredModel = Deno.env.get('GEMINI_MODEL');

  for (const model of geminiModelCandidates(configuredModel)) {
    try {
      const upstream = await fetch(geminiEndpointUrl(model, streaming), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120_000),
      });
      if (upstream.ok && upstream.body) return forwardGeminiResponse(upstream, streaming);
      lastStatus = upstream.status;
      await upstream.body?.cancel().catch(() => {});
    } catch (error) {
      console.error('Gemini upstream request failed:', error instanceof Error ? error.name : 'unknown');
    }
  }

  return json({ error: 'Agak could not get a response right now.' }, lastStatus >= 400 && lastStatus < 500 ? lastStatus : 502);
});

export default { fetch: handler };
