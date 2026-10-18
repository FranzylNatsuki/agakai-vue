# Onboarding permission guidance

`src/services/permissionGuidance.ts` selects matching locale keys and bundled audio filenames. Only a **native Android** build uses the “While using the app” instruction. A browser running on Android still uses the web variant. Dialogue never names an operating system.

## Verified labels and limits

- Android's current [PermissionController strings](https://android.googlesource.com/platform/packages/modules/Permission/+/refs/heads/main/PermissionController/res/values/strings.xml): “While using the app”, “Only this time”, “Don’t allow”. [Android documentation](https://developer.android.com/training/permissions/requesting#one-time) explains temporary grants. The installed Capacitor Android bridge requests native microphone/location permissions for the web APIs used here.
- Apple's [privacy examples](https://developer.apple.com/design/human-interface-guidelines/privacy) show **native location** choices “Allow Once”, “Allow While Using App”, and “Don’t Allow”. These are not interchangeable with web-location prompts.
- [WebKit's media permission implementation](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/Cocoa/MediaPermissionUtilities.mm) uses “Allow” and “Don’t Allow” for web microphone/location prompts.

The app currently uses `getUserMedia` and `navigator.geolocation`, not a native iOS geolocation plugin. Do not apply native iOS location-button wording to this flow without device verification. Web location guidance says to allow access without assuming a particular button label. Device/system language, browser version and manufacturer can change labels. English button quotations assume an English system prompt; the app's selected language does not control that prompt. Actual iPhone prompt sequencing and native-speaker review remain outstanding.

## Speech assets

The 12 `*-v2.wav` permission clips cover English, Cebuano and Tagalog, with web and native-Android variants. They are generated from the exact displayed locale strings through the authenticated `elevenlabs-voice/tts` gateway; no provider credentials are used by the generator. The app plays bundled files before sign-in—no live onboarding speech requests.

`public/audio/onboarding/permission-clips.json` records source text hashes. Routing tests verify each selected file exists and matches its locale text. Old unversioned clips remain unused for these two steps.

```sh
# Local dry run; no sign-in, generation or spending.
node scripts/generate-permission-audio.mjs

# Only after explicit spending approval, with an authorized test account supplied
# via AGAKAI_AUDIO_SENIOR_ID and AGAKAI_AUDIO_PIN in the environment:
node scripts/generate-permission-audio.mjs --generate
```

Generation skips unchanged clips, runs sequentially, stops on the first failure without automatic paid retries, and signs out only its own session. It uses public Supabase configuration from the existing environment and never persists Auth tokens. It does not change server secrets or voice/model configuration. Update filenames/version when replacing already-distributed recordings to avoid stale cached audio.
