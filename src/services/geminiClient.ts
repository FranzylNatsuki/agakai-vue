import { appConfig } from '@/services/appConfig';
import { getAuthenticatedFunctionHeaders } from '@/services/supabaseFunctions';

async function requestGemini(
  operation: 'generate' | 'stream',
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  const headers = await getAuthenticatedFunctionHeaders();
  return fetch(`${appConfig.geminiFunctionUrl}/${operation}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
    signal,
  });
}

export const generateWithGemini = (
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> => requestGemini('generate', payload, signal);

export const streamWithGemini = (
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> => requestGemini('stream', payload, signal);
