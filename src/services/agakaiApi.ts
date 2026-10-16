import { appConfig } from '@/services/appConfig';
import { mockAnswer } from '@/data/mock';

export type AgakEvent =
  | { type: 'transcript'; question: string }
  | { type: 'delta'; text: string }
  | { type: 'audio'; chunk: Uint8Array }
  | { type: 'done'; answer: string }
  | { type: 'error'; message: string };

export interface ChatRequest {
  text?: string;
  audioBytes?: Uint8Array;
  audioFormat?: string;
  user?: Record<string, unknown> | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Streaming chat client (Supabase edge function).
 * TODO(backend): implement real SSE streaming against the chat edge function.
 * With VITE_USE_MOCK_DATA=true it simulates a streamed answer for UI preview.
 */
export const agakApi = {
  async *chatStream(req: ChatRequest): AsyncGenerator<AgakEvent> {
    if (!appConfig.useMockData) {
      yield { type: 'error', message: 'The assistant is not connected to the backend yet.' };
      return;
    }

    if (req.audioBytes) {
      await sleep(800);
      yield { type: 'transcript', question: 'Unsaon pag dawat sa Social Pension?' };
    }
    await sleep(700);
    let answer = '';
    for (const word of mockAnswer.split(/(\s+)/)) {
      answer += word;
      yield { type: 'delta', text: word };
      await sleep(25);
    }
    yield { type: 'done', answer };
  },
};
