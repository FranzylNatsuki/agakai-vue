# AgakAI

Vue 3 + Ionic + Capacitor app. Gemini handles chat; **ElevenLabs alone handles STT and TTS**.

- Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in your local `.env`; see `.env.example` for other settings. Restart Vite after changes.
- Run `npm run dev` for the client. Voice requests go directly to the authenticated Supabase Edge Function (`elevenlabs-voice`); configure its ElevenLabs secrets in Supabase before using STT/TTS. No local voice server is used.
- STT transcribes the completed recording after Stop. TTS plays streamed PCM audio. No Groq, Gemini speech, or browser-speech fallback.
- Live speech consumes ElevenLabs quota; voice quality and Cebuano accent need native-speaker testing.

Checks: `npm run typecheck`, `npm run test:voice` (Node 22.6+, mocked requests), `npm run build`.

`index.html` is Vite's required entry point. `docs/database/legacy-schema.sql` is reference-only, not a safe production migration.

Demo sign-in (staging only): `SC-2024-0001` / `123456`. Setup steps in `docs/demo-account.md`.
