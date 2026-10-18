# AgakAI

Vue 3 + Ionic + Capacitor. Gemini handles chat and memory; ElevenLabs handles speech-to-text and text-to-speech.

## Setup

- Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`.
- Store `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_VOICE_ID` as Supabase Edge Function secrets. Optional voice model settings are listed in `.env.example`.
- Deploy the authenticated `gemini-ai` and `elevenlabs-voice` functions. Gemini uses Flash-Lite models and streams SSE through its Edge Function; voice playback streams PCM.
- Run `npm run dev` for the app.

Checks: `npm run typecheck`, `npm run test:voice`, `npm run build`.

Demo account (staging): `SC-2024-0001` / `123456`.
