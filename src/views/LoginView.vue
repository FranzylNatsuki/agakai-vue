<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { IonPage, IonIcon } from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import { authService } from '@/services/authService';
import { ttsPlayer } from '@/services/ttsPlayer';
import { APP_LANGUAGES, useSettings } from '@/composables/useSettings';

const router = useRouter();
const route = useRoute();
const { language, t } = useSettings();

const seniorId = ref('');
const pin = ref('');
const obscure = ref(true);
const isLoading = ref(false);
const errorMessage = ref('');
const showError = ref(false);
const showOnboardingWelcome = ref(false);
let loginAudio: HTMLAudioElement | null = null;
let errorTimer: ReturnType<typeof setTimeout> | null = null;
let removeAppStateListener: (() => void) | null = null;
let loginUnmounted = false;

function stopLoginAudio() {
  if (!loginAudio) return;
  const audio = loginAudio;
  loginAudio = null;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  try { audio.currentTime = 0; } catch { /* media may not be ready */ }
}

function playLoginAudio(name: string) {
  stopLoginAudio();
  const locale = APP_LANGUAGES.find((option) => option.id === language.value)?.code ?? 'en';
  const audio = new Audio(`/audio/login/${locale}/${name}.wav`);
  loginAudio = audio;
  const finish = () => {
    if (loginAudio === audio) loginAudio = null;
  };
  audio.onended = finish;
  audio.onerror = finish;
  void audio.play().catch(finish);
}

function fail(key: string, audioName: string) {
  errorMessage.value = t(key);
  showError.value = true;
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    showError.value = false;
  }, 5000);
  playLoginAudio(audioName);
}

onMounted(async () => {
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', stopLoginAudio);
  showOnboardingWelcome.value = route.query.welcome === 'onboarding';
  if (showOnboardingWelcome.value) {
    playLoginAudio('guidance');
    void router.replace({ name: 'login' });
  }
  const listener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) stopLoginAudio();
  }).catch(() => null);
  if (!listener) return;
  if (loginUnmounted) void listener.remove();
  else removeAppStateListener = () => { void listener.remove(); };
});

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') stopLoginAudio();
}

onBeforeUnmount(() => {
  loginUnmounted = true;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('pagehide', stopLoginAudio);
  removeAppStateListener?.();
  stopLoginAudio();
  if (errorTimer) clearTimeout(errorTimer);
});

async function login() {
  const id = seniorId.value.trim();
  const code = pin.value.trim();
  if (!id || !code) {
    fail('login_fill_fields', 'fill-fields');
    return;
  }

  isLoading.value = true;
  stopLoginAudio();
  void ttsPlayer.stop();
  try {
    await authService.login(id, code);
    await router.replace({ name: 'app' });
  } catch (error) {
    const message = String((error as Error)?.message ?? error).toLowerCase();
    const networkFailure = /network|fetch|timeout|offline|connection/.test(message);
    fail(networkFailure ? 'login_network_error' : 'login_invalid_credentials', networkFailure ? 'network-error' : 'invalid-credentials');
  } finally {
    isLoading.value = false;
  }
}

function onPinInput(event: Event) {
  const input = event.target as HTMLInputElement;
  pin.value = input.value.replace(/\D/g, '').slice(0, 6);
}
</script>

<template>
  <IonPage>
    <div class="agakai-login">
      <section class="login-main fade-in">
        <img class="login-logo" src="/assets/logo.png?v=repair2" alt="AgakAI" />
        <div v-if="showOnboardingWelcome" class="login-guidance-group">
          <p class="login-guidance">{{ t('login_guidance') }}</p>
        </div>

        <form class="login-card fade-up" @submit.prevent="login">
          <div class="field">
            <label class="field__label" for="senior-id">{{ t('senior_id') }}</label>
            <div class="field__box">
              <input
                id="senior-id"
                v-model="seniorId"
                class="senior-id-input"
                type="text"
                :placeholder="t('login_id_placeholder')"
                autocomplete="username"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
              />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="senior-pin">{{ t('pin') }}</label>
            <div class="field__box">
              <input
                id="senior-pin"
                :value="pin"
                :type="obscure ? 'password' : 'text'"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="6"
                :placeholder="t('login_pin_placeholder')"
                autocomplete="current-password"
                @input="onPinInput"
              />
              <button
                class="eye"
                type="button"
                :aria-label="t('login_toggle_pin')"
                @click="obscure = !obscure"
              >
                <IonIcon :icon="obscure ? eyeOffOutline : eyeOutline" />
              </button>
            </div>
          </div>

          <button class="btn pri submit-btn" type="submit" :disabled="isLoading">
            <LoadingSpinner v-if="isLoading" :size="22" class="login-spinner" />
            <template v-else>{{ t('login_submit') }}</template>
          </button>
        </form>
      </section>

      <div class="toast" :class="{ on: showError }">{{ errorMessage }}</div>
    </div>
  </IonPage>
</template>

<style scoped>
.agakai-login {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  color: var(--ink);
}

.login-main {
  flex: 1;
  overflow-y: auto;
  padding: 32px 20px calc(28px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.login-logo {
  display: block;
  width: 240px;
  max-width: 80%;
  height: auto;
  object-fit: contain;
}

.login-guidance-group {
  display: grid;
  justify-items: center;
  gap: 8px;
  max-width: 440px;
  margin-top: -8px;
}

.login-guidance {
  max-width: 440px;
  margin: 0;
  color: var(--ink);
  font-size: 1rem;
  line-height: 1.45;
  text-align: center;
}

.login-card {
  width: 100%;
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 28px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 12px 32px rgba(10, 20, 50, 0.08);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  font-size: calc(15px * var(--text-scale, 1));
  font-weight: 700;
  color: var(--muted);
  padding: 0 4px;
}

.field__box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 60px;
  padding: 0 16px;
  border-radius: 20px;
  background: var(--solid);
  border: 1px solid var(--line);
  transition: border-color 0.15s ease;
}

.field__box:focus-within {
  border-color: var(--a2);
}

.field__box input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--fs);
  font-weight: 600;
  color: var(--ink);
  outline: none;
}

.field__box input::placeholder {
  color: var(--muted);
  font-weight: 400;
}

.eye {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 22px;
  color: var(--muted);
}

.btn {
  min-height: 58px;
  border-radius: 20px;
  background: var(--solid);
  font-weight: 700;
  font-size: calc(var(--fs) * 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--line);
  padding: 0 16px;
  transition: transform 0.14s ease;
}

.btn:active {
  transform: scale(0.985);
}

.btn.pri {
  background: var(--grad);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 8px 22px var(--glow);
}

.submit-btn {
  margin-top: 6px;
}

.login-spinner {
  border-color: rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
}

.toast {
  position: absolute;
  left: 50%;
  top: 32px;
  transform: translateX(-50%);
  background: var(--danger);
  color: #fff;
  padding: 12px 20px;
  border-radius: 24px;
  font-weight: 700;
  font-size: calc(15px * var(--text-scale, 1));
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  z-index: 11;
  max-width: 90%;
  text-align: center;
}

.toast.on {
  opacity: 1;
}
</style>
