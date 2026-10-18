const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const DEFAULT_GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

export function geminiModelCandidates(configuredModel?: string): string[] {
  return [...new Set([configuredModel?.trim(), ...DEFAULT_GEMINI_MODELS].filter(Boolean))] as string[];
}

export function geminiEndpointUrl(model: string, streaming: boolean): URL {
  const method = streaming ? 'streamGenerateContent' : 'generateContent';
  const url = new URL(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:${method}`);
  if (streaming) url.searchParams.set('alt', 'sse');
  return url;
}

/** Passes through the upstream body without reading or buffering it. */
export function forwardGeminiResponse(upstream: Response, streaming: boolean): Response {
  const headers = new Headers({
    'Cache-Control': streaming ? 'no-cache, no-transform' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  else if (streaming) headers.set('Content-Type', 'text/event-stream; charset=utf-8');
  if (streaming) headers.set('X-Accel-Buffering', 'no');

  return new Response(upstream.body, { status: upstream.status, headers });
}
