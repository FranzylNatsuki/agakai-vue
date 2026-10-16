<<<<<<< HEAD
# AgakAI (Vue + Ionic + Capacitor)

Frontend-only port of the Flutter app in `../lib`. Backend (Supabase) calls are blank placeholders.

## Run

```bash
npm install
npm run dev            # browser preview (http://localhost:5173)

npm run cap:add:android   # once
npm run cap:android       # build + sync + open Android Studio
npm run cap:add:ios       # once
npm run cap:ios
```

## Mock data

`.env` has `VITE_USE_MOCK_DATA=true`, so services return sample data from `src/data/mock.ts`
(any Senior ID / password logs in). Set it to `false` to see the real "blank" behaviour.

## Structure

```
src/
  theme/         design tokens (AppColors) + global css
  locales/       en / bis / tl JSON (same as Flutter assets/lang)
  composables/   useSettings (language + text size)
  models/        Benefit, Profile
  services/      ← backend TODOs live here (auth, profile, benefits, chat, recorder, tts, supabase)
  components/
    common/      header, bottom nav, modal, bottom sheet, toggles, markdown…
    login/ home/ benefits/ voice/
  views/         LoginView, AppShellView (tabs), HomeView, VoiceAssistantView, BenefitsView
```

## Backend TODO checklist

- `services/authService.ts` – query `user` by `senior_id` + `password`
- `services/profileService.ts` – load profile / `user_notes`
- `services/benefitService.ts` – load from `benefit` table
- `services/agakaiApi.ts` – SSE chat edge function (transcript/delta/audio/done/error)
- `services/voiceRecorder.ts` / `ttsPlayer.ts` – mic capture + audio playback (Capacitor plugin or MediaRecorder)
- `composables/useSettings.ts` – persist language / text size
=======
# agakai-vue
Vue adaptation of AgakAI.
>>>>>>> 1ba8cd4aa65d251788742e5c2da187042e2b62f4
