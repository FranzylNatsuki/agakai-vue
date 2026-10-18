# AgakAI implementation

- Current work extends the existing speech services: ElevenLabs is the only STT/TTS provider; do not add speech fallbacks. Preserve the approved Vue/Ionic UI and Gemini chat behavior.
- Keep ElevenLabs credentials server-side. The local Vite voice gateway is development-only; public deployment requires an authenticated gateway.
- Speech configuration belongs in `src/services/appConfig.ts`; document settings briefly in `.env.example`. Test provider routing without paid API calls.
