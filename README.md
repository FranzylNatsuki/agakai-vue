# AgakAI

Vue 3 + Ionic + Capacitor app. Gemini handles chat; **ElevenLabs alone handles STT and TTS**.

- Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in your local `.env`; see `.env.example` for other settings. Restart Vite after changes.
- Run `npm run dev`. The included voice gateway accepts same-origin localhost requests and keeps the ElevenLabs key server-side. Public/native deployment requires an authenticated gateway; this local gateway is not a production backend.
- STT transcribes the completed recording after Stop. TTS plays streamed PCM audio. No Groq, Gemini speech, or browser-speech fallback.
- Live speech consumes ElevenLabs quota; voice quality and Cebuano accent need native-speaker testing.

Checks: `npm run typecheck`, `npm run test:voice` (Node 22.6+, mocked requests), `npm run build`.

`index.html` is Vite's required entry point. `docs/database/legacy-schema.sql` is reference-only, not a safe production migration.

Demo sign-in (staging only): `SC-2024-0001` / `123456`. Setup steps in `docs/demo-account.md`.

## Recent Updates & Messaging Implementation

### 1. Database Schema & Messaging Backend (`public.messages`)
- Implemented peer-to-peer and service messaging based on `databasedesign.txt`.
- Created Supabase migration [`supabase/migrations/20261018123000_messages.sql`](supabase/migrations/20261018123000_messages.sql) with:
  - Table `public.messages` with sender (`sender_id`) and receiver (`receiver_id`) foreign keys referencing `public.user(id)`.
  - Row-Level Security (RLS) policies allowing seniors to select and insert only their own messages.
  - Performance indexes on `(sender_id, receiver_id, created_at)` and `(receiver_id, sender_id, created_at)`.
  - RPC function `public.get_chat_contacts()` aggregating conversation partners with their latest message preview and timestamp.
- Created message service and models ([`src/services/messageService.ts`](src/services/messageService.ts), [`src/models/message.ts`](src/models/message.ts)) supporting:
  - Realtime subscriptions via Supabase channels.
  - Graceful fallback to mock data ([`src/data/mock.ts`](src/data/mock.ts)) for local offline development.
- Added comprehensive unit tests in [`tests/messaging.test.mjs`](tests/messaging.test.mjs) (all 29 tests pass via `npm run test:voice`).

### 2. Full-Screen Messaging Interface & Navigation Flow
- Built senior-friendly messaging components:
  - [`src/components/messaging/ChatList.vue`](src/components/messaging/ChatList.vue): Contact list with 56px circular avatars, bold initials, unread indicators, and message previews.
  - [`src/components/messaging/ChatThread.vue`](src/components/messaging/ChatThread.vue): Full conversation thread with message bubbles, ElevenLabs TTS read-aloud button ("Hear"), voice dictation mic input, and 56px touch targets.
  - [`src/components/messaging/MessagesSheet.vue`](src/components/messaging/MessagesSheet.vue): Coordinating view for contact list and active thread navigation.
- **Full-Screen Chat**: Configured the messaging overlay (`.fullscreen-chat`) to occupy the full screen by default (`position: absolute; inset: 0; z-index: 25;`).
- **Navigation Dock Layout**: Removed the chat icon from the bottom navigation dock pill to preserve the clean 3-button layout (**Type**, **Talk**, **Menu**) with enlarged touch targets (60px and 84px circles), keeping the Messages entry accessible inside the **Menu** popover ("My messages & friends").

### 3. Senior Typography & Dynamic Font Scaling
- Significantly enlarged font sizes across the messaging module to improve legibility for elderly Filipino seniors (*Lolo* and *Lola*):
  - Sheet Title: `calc(var(--fs, 20px) * 1.25)` (~25px – 35px).
  - Contact & Recipient Names: `calc(var(--fs, 20px) * 1.05 – 1.15)` (~21px – 32.2px).
  - Message Bubble Text: `calc(var(--fs, 20px) * 1.05)` (~21px – 29.4px) with relaxed `1.5` line height.
  - Message Timestamps: `calc(var(--fs, 20px) * 0.72)` (~14.4px – 20px).
  - Composer Input Field: 56px height with `calc(var(--fs, 20px) * 0.95)` (~19px – 26.6px) text.
- Connected all typography directly to the app's 3-tier font size preference system (`--fs`: Standard 20px, Medium 24px, Large 28px).

### 4. High-Contrast Text Color Design (Black Text on White Backgrounds)
- Enforced pure black (`#000000`) typography across all white and light surfaces:
  - Updated design tokens in [`src/theme/variables.css`](src/theme/variables.css): `--ink: #000000;` and `--muted: #000000;` in `:root`.
  - Added global contrast rules in [`src/theme/global.css`](src/theme/global.css) ensuring containers with white backgrounds force text to `#000000`.
  - Replaced all gray/muted text (`#4b5563`, `#374151`, `#6b7280`, `#64748b`) on white backgrounds with pure black in `AppShellView.vue`, `LoginView.vue`, `ChatList.vue`, `ChatThread.vue`, `MessagesSheet.vue`, `BottomSheet.vue`, and `MarkdownContent.vue`.

### 5. Dark-Theme Browser Consistency
- Guaranteed that the high-contrast text color design remains identical when the user's browser or operating system is set to dark mode:
  - Set `<meta name="color-scheme" content="light" />` in [`index.html`](index.html) to prevent browser user agents from auto-inverting form controls and backgrounds.
  - Overrode `@media (prefers-color-scheme: dark)` and `:root[data-theme='dark']` in `variables.css` and `global.css` to maintain light tokens (`--bg: #ffffff;`, `--solid: #ffffff;`, `--ink: #000000;`, `--muted: #000000;`, `color-scheme: light !important;`).
  - Inputs, placeholders, buttons, and text surfaces remain readable and high-contrast regardless of browser system theme.
