<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IonIcon, IonPage } from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  alertCircleOutline,
  checkmarkOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import {
  APP_LANGUAGES,
  TEXT_SIZES,
  useSettings,
  type AppLanguage,
  type TextSizeIndex,
} from '@/composables/useSettings';
import { authService } from '@/services/authService';
import { hasLocationPermission, requestLocationPermission } from '@/services/location';
import { openPermissionSettings as launchPermissionSettings } from '@/services/permissionSettings';
import { voiceRecorder } from '@/services/voiceRecorder';
import { permissionGuidance } from '@/services/permissionGuidance';
import { startupSplashHidden } from '@/services/startupSplash';

const router = useRouter();
const { language, textSizeIndex, setLanguage, setTextSizeIndex, t } = useSettings();
const step = ref<1 | 2 | 3 | 4>(1);
const nativePlatform = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web';
const currentPermissionGuidance = computed(() =>
  permissionGuidance(step.value === 3 ? 'microphone' : 'location', nativePlatform),
);
const dialogueText = computed(() => t(
  step.value === 1 ? 'onboarding_language_prompt'
    : step.value === 2 ? 'onboarding_text_prompt' : currentPermissionGuidance.value.textKey,
));
const stepTitle = computed(() => t([
  'onboarding_language_title',
  'onboarding_text_title',
  'onboarding_microphone_title',
  'onboarding_location_title',
][step.value - 1]));
const permissionBusy = ref<'microphone' | 'location' | 'settings' | null>(null);
const microphoneAttempts = ref(readPermissionAttempts('agakai_mic_permission_denials_v2'));
const locationAttempts = ref(readPermissionAttempts('agakai_location_permission_denials_v2'));
const settingsPending = ref<'microphone' | 'location' | null>(null);
const microphoneReady = ref(false);
const locationReady = ref(false);
const microphoneStatus = ref('');
const locationStatus = ref('');
const primaryLabel = computed(() => {
  if (permissionBusy.value) return t('onboarding_requesting_permission');
  const needsMicrophone = step.value === 3 && !microphoneReady.value;
  const needsLocation = step.value === 4 && !locationReady.value;
  if (needsMicrophone || needsLocation) {
    const attempts = needsMicrophone ? microphoneAttempts.value : locationAttempts.value;
    if (attempts >= 2) return t('onboarding_open_settings');
    if (attempts > 0) return t('onboarding_retry_permission');
    return t(needsMicrophone ? 'onboarding_enable_microphone' : 'onboarding_allow_location');
  }
  return t(step.value === 4 ? 'onboarding_continue_to_login' : 'onboarding_continue');
});

async function primaryAction() {
  if (permissionBusy.value) return;
  if (step.value === 3 && !microphoneReady.value) await allowMicrophone();
  else if (step.value === 4 && !locationReady.value) await allowLocation();
  else await continueSetup();
}

const dialoguePlaying = ref(false);
const dialogueStatus = ref('');
const dialogueGeneration = ref(0);
let dialogueAudio: HTMLAudioElement | null = null;
let dialogueTimeout: ReturnType<typeof setTimeout> | null = null;
let dialogueEnded = false;
let removeAppStateListener: (() => void) | null = null;
let onboardingUnmounted = false;
let permissionRefreshBusy = false;
let permissionStateVersion = 0;

type SavedPermissionState = 'granted' | 'denied';

function permissionStateKey(permission: 'microphone' | 'location'): string {
  return permission === 'microphone'
    ? 'agakai_mic_permission_state'
    : 'agakai_location_permission_state';
}

function readPermissionState(permission: 'microphone' | 'location'): SavedPermissionState | null {
  if (typeof localStorage === 'undefined') return null;
  const state = localStorage.getItem(permissionStateKey(permission));
  return state === 'granted' || state === 'denied' ? state : null;
}

function savePermissionState(permission: 'microphone' | 'location', state: SavedPermissionState) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(permissionStateKey(permission), state);
}

function readPermissionAttempts(key: string): number {
  if (typeof localStorage === 'undefined') return 0;
  const count = Number(localStorage.getItem(key));
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function savePermissionAttempts(permission: 'microphone' | 'location', count: number) {
  const key = permission === 'microphone'
    ? 'agakai_mic_permission_denials_v2'
    : 'agakai_location_permission_denials_v2';
  if (typeof localStorage === 'undefined') return;
  if (count > 0) localStorage.setItem(key, String(count));
  else localStorage.removeItem(key);
}

function setPermissionReady(permission: 'microphone' | 'location', ready: boolean, announce = false) {
  if (permission === 'microphone') {
    microphoneReady.value = ready;
    microphoneStatus.value = ready
      ? t('onboarding_mic_ready')
      : microphoneAttempts.value >= 2 ? t('onboarding_permission_settings_hint') : '';
    if (ready && announce) void playAudioFile('microphone-ready');
    if (ready) {
      savePermissionState('microphone', 'granted');
      microphoneAttempts.value = 0;
      savePermissionAttempts('microphone', 0);
    }
    return;
  }

  locationReady.value = ready;
  locationStatus.value = ready
    ? t('onboarding_location_ready')
    : locationAttempts.value >= 2 ? t('onboarding_permission_settings_hint') : '';
  if (ready && announce) void playAudioFile('location-ready');
  if (ready) {
    savePermissionState('location', 'granted');
    locationAttempts.value = 0;
    savePermissionAttempts('location', 0);
  }
}

async function refreshPermissions() {
  if (
    permissionRefreshBusy
    || permissionBusy.value === 'microphone'
    || permissionBusy.value === 'location'
  ) return;
  permissionRefreshBusy = true;
  const requestVersion = permissionStateVersion;
  const returningFromSettings = settingsPending.value;
  settingsPending.value = null;
  try {
    if (returningFromSettings === 'microphone') {
      const granted = await voiceRecorder.hasPermission();
      if (requestVersion !== permissionStateVersion) return;
      if (granted === true) setPermissionReady('microphone', true, true);
      else {
        if (granted === false) savePermissionState('microphone', 'denied');
        microphoneStatus.value = t('onboarding_permission_settings_hint');
        playPermissionError('microphone');
      }
      return;
    }
    if (returningFromSettings === 'location') {
      const granted = await hasLocationPermission();
      if (requestVersion !== permissionStateVersion) return;
      if (granted === true) setPermissionReady('location', true, true);
      else {
        if (granted === false) savePermissionState('location', 'denied');
        locationStatus.value = t('onboarding_permission_settings_hint');
        playPermissionError('location');
      }
      return;
    }

    const [microphone, location] = await Promise.all([
      voiceRecorder.hasPermission(),
      hasLocationPermission(),
    ]);
    if (requestVersion !== permissionStateVersion) return;

    if (microphone === true) setPermissionReady('microphone', true);
    else if (microphone === false) {
      if (microphoneReady.value || readPermissionState('microphone') === 'granted') {
        setPermissionReady('microphone', false);
        savePermissionState('microphone', 'denied');
        microphoneStatus.value = t('onboarding_permission_required');
      } else if (microphoneAttempts.value > 0 || readPermissionState('microphone') === 'denied') {
        microphoneStatus.value = t(
          microphoneAttempts.value >= 2 ? 'onboarding_permission_settings_hint' : 'onboarding_mic_denied',
        );
      }
    } else if (readPermissionState('microphone') === 'denied' && microphoneAttempts.value > 0) {
      microphoneStatus.value = t(
        microphoneAttempts.value >= 2 ? 'onboarding_permission_settings_hint' : 'onboarding_mic_denied',
      );
    }

    if (location === true) setPermissionReady('location', true);
    else if (location === false) {
      if (locationReady.value || readPermissionState('location') === 'granted') {
        setPermissionReady('location', false);
        savePermissionState('location', 'denied');
        locationStatus.value = t('onboarding_permission_required');
      } else if (locationAttempts.value > 0 || readPermissionState('location') === 'denied') {
        locationStatus.value = t(
          locationAttempts.value >= 2 ? 'onboarding_permission_settings_hint' : 'onboarding_location_denied',
        );
      }
    } else if (readPermissionState('location') === 'denied' && locationAttempts.value > 0) {
      locationStatus.value = t(
        locationAttempts.value >= 2 ? 'onboarding_permission_settings_hint' : 'onboarding_location_denied',
      );
    }
  } finally {
    permissionRefreshBusy = false;
  }
}

async function openSettingsFor(permission: 'microphone' | 'location') {
  permissionStateVersion++;
  permissionBusy.value = 'settings';
  settingsPending.value = permission;
  const opened = await launchPermissionSettings();
  if (!opened) {
    const message = t('onboarding_settings_manual');
    if (permission === 'microphone') microphoneStatus.value = message;
    else locationStatus.value = message;
    void playAudioFile('settings-manual');
  }
  permissionBusy.value = null;
}

function setDialogueStatus(key: string) {
  dialogueStatus.value = t(key);
}

function interruptDialogue() {
  if (!dialoguePlaying.value) return;
  stopDialogue();
}

function permissionPromptActive(): boolean {
  return permissionBusy.value === 'microphone' || permissionBusy.value === 'location';
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden' && !permissionPromptActive()) interruptDialogue();
}

function handlePageHide() {
  if (!permissionPromptActive()) interruptDialogue();
}

function handleWindowFocus() {
  void refreshPermissions();
}

function clearDialogueTimeout() {
  if (dialogueTimeout) clearTimeout(dialogueTimeout);
  dialogueTimeout = null;
}

function stopDialogue(resetPosition = true) {
  dialogueGeneration.value++;
  clearDialogueTimeout();
  const player = dialogueAudio;
  dialogueAudio = null;
  dialogueEnded = false;
  dialoguePlaying.value = false;
  if (player) {
    player.onended = null;
    player.onerror = null;
    player.onpause = null;
    player.onplaying = null;
    player.pause();
    if (resetPosition) {
      try { player.currentTime = 0; } catch { /* media may not be ready */ }
    }
    player.removeAttribute('src');
    player.load();
  }
}

async function playAudioFile(audioName: string) {
  stopDialogue();
  dialogueStatus.value = '';
  const generation = dialogueGeneration.value;
  const locale = APP_LANGUAGES.find((option) => option.id === language.value)?.code ?? 'en';
  const player = new Audio(`/audio/onboarding/${locale}/${audioName}.wav`);
  dialogueAudio = player;
  dialoguePlaying.value = true;

  const isCurrent = () => dialogueAudio === player && dialogueGeneration.value === generation;
  const fail = () => {
    if (!isCurrent()) return;
    stopDialogue();
    setDialogueStatus('onboarding_audio_unavailable');
  };
  const finish = () => {
    if (!isCurrent() || dialogueEnded) return;
    dialogueEnded = true;
    stopDialogue();
  };
  const checkPlayback = () => {
    if (!isCurrent() || dialogueEnded) return;
    if (player.ended) {
      finish();
      return;
    }
    if (player.paused || player.error) {
      fail();
      return;
    }
    dialogueTimeout = setTimeout(checkPlayback, 400);
  };

  player.onended = finish;
  player.onerror = fail;
  player.onpause = () => {
    if (isCurrent() && !player.ended) interruptDialogue();
  };
  player.onplaying = () => {
    if (isCurrent()) dialogueStatus.value = '';
  };

  try {
    await player.play();
    if (!isCurrent()) return;
    dialogueTimeout = setTimeout(checkPlayback, 400);
  } catch {
    if (isCurrent()) {
      stopDialogue();
      setDialogueStatus('onboarding_audio_unavailable');
    }
  }
}

async function playDialogue() {
  const audioName = step.value === 1 ? 'language'
    : step.value === 2 ? 'text-size' : currentPermissionGuidance.value.audioName;
  await playAudioFile(audioName);
}

function playPermissionError(permission: 'microphone' | 'location') {
  const attempts = permission === 'microphone' ? microphoneAttempts.value : locationAttempts.value;
  void playAudioFile(attempts >= 2 ? 'permission-settings-needed' : `${permission}-denied`);
}

function chooseLanguage(value: AppLanguage) {
  stopDialogue();
  setLanguage(value);
}

function goBack() {
  stopDialogue();
  step.value = (step.value - 1) as 1 | 2 | 3;
}

watch(step, async (current, previous) => {
  if (current === previous) return;
  stopDialogue();
  await nextTick();
  void playDialogue();
});

watch(language, (current, previous) => {
  if (current === previous || step.value !== 1) return;
  stopDialogue();
  void playDialogue();
});

onMounted(async () => {
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('focus', handleWindowFocus);
  void startupSplashHidden.then(() => {
    if (!onboardingUnmounted) void playDialogue();
  });
  void refreshPermissions();
  const listener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void refreshPermissions();
    else if (!permissionPromptActive()) interruptDialogue();
  }).catch(() => null);
  if (!listener) return;
  if (onboardingUnmounted) void listener.remove();
  else removeAppStateListener = () => { void listener.remove(); };
});

onBeforeUnmount(() => {
  onboardingUnmounted = true;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('pagehide', handlePageHide);
  window.removeEventListener('focus', handleWindowFocus);
  removeAppStateListener?.();
  stopDialogue();
});

function recordPermissionDenial(permission: 'microphone' | 'location') {
  if (permission === 'microphone') {
    microphoneAttempts.value++;
    savePermissionAttempts('microphone', microphoneAttempts.value);
    savePermissionState('microphone', 'denied');
    microphoneStatus.value = t(
      microphoneAttempts.value >= 2 ? 'onboarding_permission_settings_hint' : 'onboarding_mic_denied',
    );
  } else {
    locationAttempts.value++;
    savePermissionAttempts('location', locationAttempts.value);
    savePermissionState('location', 'denied');
    locationStatus.value = t(
      locationAttempts.value >= 2 ? 'onboarding_permission_settings_hint' : 'onboarding_location_denied',
    );
  }
  playPermissionError(permission);
}

async function allowMicrophone() {
  if (microphoneAttempts.value >= 2) {
    await openSettingsFor('microphone');
    return;
  }
  permissionStateVersion++;
  dialogueStatus.value = '';
  microphoneStatus.value = '';
  permissionBusy.value = 'microphone';
  try {
    const granted = await voiceRecorder.requestPermission();
    if (granted) setPermissionReady('microphone', true, true);
    else recordPermissionDenial('microphone');
  } catch {
    recordPermissionDenial('microphone');
  } finally {
    permissionBusy.value = null;
  }
}

async function allowLocation() {
  if (locationAttempts.value >= 2) {
    await openSettingsFor('location');
    return;
  }
  permissionStateVersion++;
  dialogueStatus.value = '';
  locationStatus.value = '';
  permissionBusy.value = 'location';
  try {
    const granted = await requestLocationPermission();
    if (granted) setPermissionReady('location', true, true);
    else recordPermissionDenial('location');
  } catch {
    recordPermissionDenial('location');
  } finally {
    permissionBusy.value = null;
  }
}

async function continueSetup() {
  if (step.value === 3 && !microphoneReady.value) {
    microphoneStatus.value = t('onboarding_permission_required');
    void playAudioFile('permission-required');
    return;
  }
  if (step.value === 4 && !locationReady.value) {
    locationStatus.value = t('onboarding_permission_required');
    void playAudioFile('permission-required');
    return;
  }
  if (step.value < 4) {
    step.value = (step.value + 1) as 2 | 3 | 4;
    return;
  }

  stopDialogue();
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('agakai_onboarding_complete_v2', '1');
    if (microphoneReady.value) localStorage.setItem('agakai_mic_primer_seen', '1');
  }
  const hasSession = await authService.hasSession();
  await router.replace(
    hasSession ? { name: 'app' } : { name: 'login', query: { welcome: 'onboarding' } },
  );
}
</script>

<template>
  <IonPage>
    <main class="onboarding">
      <section class="onboarding__card">
        <header class="onboarding__brand">
          <img class="onboarding__logo" src="/assets/splash-logo-cropped.png" alt="AgakAI" />
        </header>

        <Transition name="guided-step" mode="out-in">
          <div :key="step" class="onboarding__step-content">
            <p class="onboarding__step" aria-live="polite">
              <span>{{ t(step === 1 ? 'onboarding_step_language' : step === 2 ? 'onboarding_step_text_size' : step === 3 ? 'onboarding_step_microphone' : 'onboarding_step_location') }}</span>
            </p>
            <h1>{{ stepTitle }}</h1>
            <p class="onboarding__dialogue" aria-live="polite">
              {{ dialogueText }}
            </p>
            <p v-if="dialogueStatus" class="onboarding__audio-status" role="status">{{ dialogueStatus }}</p>

            <fieldset v-if="step === 1" class="onboarding__group">
              <legend>{{ t('choose_language') }}</legend>
              <div class="onboarding__choices">
                <button
                  v-for="option in APP_LANGUAGES"
                  :key="option.id"
                  class="onboarding__choice"
                  :class="{ selected: language === option.id }"
                  type="button"
                  :aria-pressed="language === option.id"
                  @click="chooseLanguage(option.id as AppLanguage)"
                >
                  <span>{{ option.nativeLabel }}</span>
                  <IonIcon v-if="language === option.id" :icon="checkmarkOutline" aria-hidden="true" />
                </button>
              </div>
            </fieldset>

            <fieldset v-else-if="step === 2" class="onboarding__group">
              <legend>{{ t('text_size') }}</legend>
              <div class="onboarding__choices">
                <button
                  v-for="index in [0, 1, 2]"
                  :key="index"
                  class="onboarding__choice"
                  :class="{ selected: textSizeIndex === index }"
                  :aria-pressed="textSizeIndex === index"
                  :style="{ fontSize: `${TEXT_SIZES[index]}px` }"
                  type="button"
                  @click="setTextSizeIndex(index as TextSizeIndex)"
                >
                  <span>{{ t(index === 0 ? 'text_size_standard' : index === 1 ? 'text_size_enlarged' : 'text_size_largest') }}</span>
                  <IonIcon v-if="textSizeIndex === index" :icon="checkmarkOutline" aria-hidden="true" />
                </button>
              </div>
            </fieldset>

            <section v-else class="onboarding__permission-page">
              <p v-if="step === 3 && microphoneReady" class="onboarding__ready" role="status">
                <IonIcon :icon="checkmarkOutline" aria-hidden="true" />
                {{ t('onboarding_mic_ready') }}
              </p>
              <p v-if="step === 3 && microphoneStatus && !microphoneReady" class="onboarding__status onboarding__status--error" role="alert">
                <IonIcon :icon="alertCircleOutline" aria-hidden="true" />
                <span>{{ microphoneStatus }}</span>
              </p>
              <p v-if="step === 4 && locationReady" class="onboarding__ready" role="status">
                <IonIcon :icon="checkmarkOutline" aria-hidden="true" />
                {{ t('onboarding_location_ready') }}
              </p>
              <p v-if="step === 4 && locationStatus && !locationReady" class="onboarding__status onboarding__status--error" role="alert">
                <IonIcon :icon="alertCircleOutline" aria-hidden="true" />
                <span>{{ locationStatus }}</span>
              </p>
            </section>
          </div>
        </Transition>

        <footer class="onboarding__footer">
          <div class="onboarding__dots" aria-hidden="true">
            <span v-for="index in 4" :key="index" :class="{ active: step === index }" />
          </div>
          <div class="onboarding__actions">
            <button v-if="step > 1" class="onboarding__back" type="button" :disabled="permissionBusy !== null" @click="goBack">
              {{ t('onboarding_back') }}
            </button>
            <button
              class="onboarding__primary"
              type="button"
              :disabled="permissionBusy !== null"
              @click="primaryAction"
            >
              {{ primaryLabel }}
            </button>
          </div>
        </footer>
      </section>
    </main>
  </IonPage>
</template>

<style scoped>
.onboarding {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  background: var(--solid);
  padding: 16px 24px calc(16px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  color: var(--ink);
  font-size: var(--fs);
}
.onboarding__card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: min(100%, 480px);
  min-height: 100%;
  margin: 0 auto;
}
.onboarding__brand {
  display: flex;
  flex: none;
  justify-content: center;
  align-items: center;
  padding-bottom: 12px;
}
.onboarding__logo {
  display: block;
  width: 168px;
  max-width: 60%;
  height: auto;
  object-fit: contain;
}
.onboarding__step-content {
  display: grid;
  gap: 12px;
  width: 100%;
}
.onboarding h1 {
  margin: 0;
  color: var(--ink);
  font-size: 1.24em;
  line-height: 1.2;
  text-align: center;
}
.onboarding__step {
  margin: 0;
  color: var(--muted);
  font-size: max(0.8em, 16px);
  font-weight: 700;
  text-align: center;
}
.onboarding__dialogue {
  margin: 0;
  color: var(--muted);
  font-size: 0.9em;
  line-height: 1.4;
  text-align: center;
}
.onboarding__audio-status { margin: 0; color: var(--a2); font-size: 0.84em; text-align: center; }
.onboarding__group,
.onboarding__permission-page {
  display: grid;
  gap: 10px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
/* The heading already labels the visible choices; retain the legend for screen readers. */
.onboarding__group legend {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.onboarding__choices { display: grid; gap: 8px; }
.onboarding__choice,
.onboarding__primary,
.onboarding__back {
  min-height: 56px;
  min-width: 0;
  padding: 9px 14px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--solid);
  color: var(--ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.onboarding__choice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
}
.onboarding__choice ion-icon { flex: none; font-size: 24px; }
.onboarding__choice.selected {
  border-color: var(--a2);
  background: var(--hi);
  color: var(--a1);
}
.onboarding__primary {
  border-color: transparent;
  background: var(--grad);
  color: #fff;
}
.onboarding__ready {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--a1);
}
.onboarding__ready ion-icon { flex: none; font-size: 24px; }
.onboarding__status { color: var(--a2) !important; font-weight: 600; animation: status-in 180ms ease both; }
.onboarding__status--error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--danger-border);
  border-radius: 16px;
  background: var(--danger-soft);
  color: var(--danger) !important;
}
.onboarding__status--error ion-icon { flex: 0 0 auto; margin-top: 0.12em; font-size: 1.1em; }
.onboarding__footer {
  display: grid;
  gap: 14px;
  margin-top: auto;
  padding-top: 14px;
}
.onboarding__dots { display: flex; justify-content: center; align-items: center; gap: 8px; }
.onboarding__dots span {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--line);
}
.onboarding__dots span.active { width: 22px; background: var(--a2); }
.onboarding__actions { display: flex; gap: 10px; }
.onboarding__choice,
.onboarding__primary,
.onboarding__back {
  transition: transform 140ms ease, border-color 180ms ease, opacity 180ms ease;
}
.onboarding__choice:active,
.onboarding__primary:active,
.onboarding__back:active { transform: scale(0.98); }
.guided-step-enter-active,
.guided-step-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.guided-step-enter-from { opacity: 0; transform: translateY(8px); }
.guided-step-leave-to { opacity: 0; transform: translateY(-4px); }
@keyframes status-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.onboarding__primary { flex: 1; min-height: 56px; }
.onboarding__back { min-width: 82px; }
.onboarding__back:disabled,
.onboarding__primary:disabled { opacity: 0.65; cursor: default; }
@media (max-height: 720px) {
  .onboarding { padding: 12px 20px calc(12px + env(safe-area-inset-bottom, 0px)); }
  .onboarding__card { gap: 12px; }
  .onboarding__brand { padding-bottom: 8px; }
  .onboarding__logo { width: 140px; }
  .onboarding__step-content { gap: 8px; }
  .onboarding__footer { gap: 10px; padding-top: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .onboarding :deep(*) { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
</style>
