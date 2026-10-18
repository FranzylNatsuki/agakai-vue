# AgakAI implementation

- Current work extends the existing speech services: ElevenLabs is the only STT/TTS provider; do not add speech fallbacks. Preserve the approved Vue/Ionic UI and Gemini chat behavior.
- Keep ElevenLabs credentials server-side in Supabase Edge Function secrets. Route STT/TTS through the authenticated `elevenlabs-voice` function; do not add a local Vite voice gateway.
- Speech configuration belongs in `src/services/appConfig.ts`; document settings briefly in `.env.example`. Test provider routing without paid API calls.

## Senior identity
- Seniors sign in with Senior ID + 6-digit PIN through Supabase Auth. The internal address (`<senior_id>@seniors.agakai.local`) is an implementation detail; never show or collect email, and never put credentials in a client-readable table.
- RLS is the access boundary: a senior reads/updates only their own row, and column grants limit writes to `user_notes`. Keep advisors clean.
- Phone + SMS OTP is the intended future sign-in; synthetic email is the fast path until then. Migrating providers must not weaken RLS.

## Onboarding and startup
- Keep user-facing guidance and voice scripts platform-neutral; do not name Android, iOS, or another operating system in the dialogue. Match permission button wording and bundled audio to the request path via `src/services/permissionGuidance.ts`; see `docs/permission-guidance.md` for verified labels and limitations.
- Preserve the four-step language, text-size, microphone, and location setup and its permission gates. Present it in the user-approved slide format: a larger horizontally centered AgakAI logo, no decorative step icons, a clear heading, short guidance, progress dots, and bottom navigation controls.
- Onboarding and login omit listen/stop/replay controls; retain automatic spoken guidance and readable instructions. Onboarding uses one primary action per step (request permission, then continue) and a secondary Back button. Keep conversation audio controls intact.
- Android's system splash icon is masked and too small for the full wordmark. Keep the system icon neutral and show the full existing AgakAI logo and tagline in the in-app startup splash. Start automatic onboarding narration after that splash has finished displaying.
