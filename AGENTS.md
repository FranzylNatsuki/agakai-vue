# AgakAI implementation

- Current work extends the existing speech services: ElevenLabs is the only STT/TTS provider; do not add speech fallbacks. Preserve the approved Vue/Ionic UI and Gemini chat behavior.
- Keep ElevenLabs credentials server-side. The local Vite voice gateway is development-only; public deployment requires an authenticated gateway.
- Speech configuration belongs in `src/services/appConfig.ts`; document settings briefly in `.env.example`. Test provider routing without paid API calls.

## Senior identity
- Seniors sign in with Senior ID + 6-digit PIN through Supabase Auth. The internal address (`<senior_id>@seniors.agakai.local`) is an implementation detail; never show or collect email, and never put credentials in a client-readable table.
- RLS is the access boundary: a senior reads/updates only their own row, and column grants limit writes to `user_notes`. Keep advisors clean.
- Phone + SMS OTP is the intended future sign-in; synthetic email is the fast path until then. Migrating providers must not weaken RLS.
