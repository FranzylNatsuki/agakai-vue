import { appConfig } from '@/services/appConfig';
import { getVoiceAuthHeaders } from '@/services/elevenLabs';

const SOCKET_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
type TranscriptListener = (partial: string, committed: string) => void;

export class LiveTranscription {
  private socket: WebSocket;
  private partial = '';
  private committed: string[] = [];
  private listeners = new Set<TranscriptListener>();
  private failure: Error | null = null;
  private closed = false;
  private commitResolve: ((value: string) => void) | null = null;
  private commitReject: ((error: Error) => void) | null = null;
  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener('message', (event) => this.onMessage(event.data));
    socket.addEventListener('error', () => this.fail(new Error('Live transcription disconnected')));
    socket.addEventListener('close', () => {
      if (!this.closed && this.commitReject) this.fail(new Error('Live transcription disconnected'));
    });
  }

  static async connect(): Promise<LiveTranscription> {
    const headers = await getVoiceAuthHeaders();
    const response = await fetch(`${appConfig.elevenLabsFunctionUrl}/stt-token`, {
      method: 'POST', headers, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Live transcription token unavailable');
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('The Agak voice service returned an unexpected response.');
    }
    const { token } = await response.json();
    if (typeof token !== 'string' || !token) throw new Error('Invalid live transcription token');
    const url = new URL(SOCKET_URL);
    url.searchParams.set('model_id', 'scribe_v2_realtime');
    url.searchParams.set('token', token);
    url.searchParams.set('audio_format', 'pcm_16000');
    // VAD stabilizes completed phrases during natural pauses instead of
    // revising one long interim hypothesis until the user taps Done.
    url.searchParams.set('commit_strategy', 'vad');
    url.searchParams.set('vad_silence_threshold_secs', '1.5');
    url.searchParams.set('vad_threshold', '0.4');
    url.searchParams.set('min_speech_duration_ms', '100');
    url.searchParams.set('min_silence_duration_ms', '100');
    const socket = new WebSocket(url);
    const opened = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Live transcription connection timed out')), 12_000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Live transcription connection failed')); }, { once: true });
    });
    try { await opened; } catch (error) { socket.close(); throw error; }
    return new LiveTranscription(socket);
  }

  onTranscript(listener: TranscriptListener): () => void {
    this.listeners.add(listener);
    listener(this.partial, this.committed.join(' '));
    return () => { this.listeners.delete(listener); };
  }

  getTranscript(): string {
    return [this.committed.join(' '), this.partial].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  sendAudio(audioBase64: string): void {
    if (this.closed || this.failure || this.socket.readyState !== WebSocket.OPEN) return;
    if (this.socket.bufferedAmount > 512_000) {
      this.fail(new Error('Live transcription is falling behind. Stop and try again.'));
      return;
    }
    this.socket.send(JSON.stringify({
      message_type: 'input_audio_chunk', audio_base_64: audioBase64,
      sample_rate: 16000, commit: false,
    }));
  }

  async commit(): Promise<string> {
    if (this.failure || this.socket.readyState !== WebSocket.OPEN) {
      const transcript = this.getTranscript();
      if (transcript) return transcript;
      throw this.failure ?? new Error('Live transcription disconnected');
    }
    const result = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.commitResolve) return;
        this.commitResolve = null;
        this.commitReject = null;
        const transcript = this.getTranscript();
        if (transcript) resolve(transcript);
        else reject(new Error('Live transcript timed out'));
      }, 15_000);
      this.commitResolve = (text) => { clearTimeout(timer); resolve(text); };
      this.commitReject = (error) => { clearTimeout(timer); reject(error); };
    });
    this.socket.send(JSON.stringify({
      message_type: 'input_audio_chunk', audio_base_64: '',
      sample_rate: 16000, commit: true,
    }));
    return result;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.commitResolve = null;
    this.commitReject = null;
    this.listeners.clear();
    this.socket.close(1000);
  }

  private onMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    try {
      const message = JSON.parse(raw);
      if (message.message_type === 'partial_transcript') this.partial = message.text || '';
      else if (message.message_type === 'committed_transcript') {
        const text = typeof message.text === 'string' ? message.text.trim() : '';
        if (text) this.committed.push(text);
        this.partial = '';
        if (this.commitResolve) {
          const transcript = this.committed.join(' ').trim();
          const resolve = this.commitResolve;
          this.commitResolve = null;
          this.commitReject = null;
          resolve(transcript);
        }
      } else if (typeof message.message_type === 'string' && (
        message.message_type.includes('error') ||
        ['auth_error', 'quota_exceeded', 'rate_limited', 'commit_throttled', 'queue_overflow',
          'resource_exhausted', 'session_time_limit_exceeded', 'chunk_size_exceeded',
          'insufficient_audio_activity', 'unaccepted_terms'].includes(message.message_type)
      )) {
        this.fail(new Error('Live transcription failed'));
      }
      for (const listener of this.listeners) listener(this.partial, this.committed.join(' '));
    } catch { /* Ignore non-JSON websocket frames. */ }
  }

  private fail(error: Error): void {
    this.failure = error;
    this.commitReject?.(error);
    this.commitResolve = null;
    this.commitReject = null;
  }
}
