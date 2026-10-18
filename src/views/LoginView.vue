<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonPage, IonIcon } from '@ionic/vue';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import {
  APP_LANGUAGES,
  useSettings,
  type AppLanguage,
  type TextSizeIndex,
} from '@/composables/useSettings';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { ttsPlayer } from '@/services/ttsPlayer';

const router = useRouter();
const { language, textSizeIndex, setLanguage, setTextSizeIndex } = useSettings();

const seniorId = ref('');
const password = ref('');
const obscure = ref(true);
const isLoading = ref(false);
const errorMessage = ref('');
const showError = ref(false);
const settingsOpen = ref(false);

const uiText = computed(() => {
  if (language.value === 'tagalog') {
    return {
      greeting: 'Magandang araw,',
      headline: 'Mag-sign in sa Tala.',
      sub: 'Ilagay ang iyong Senior ID para makita ang benepisyo at makausap si Tala.',
      seniorIdLabel: 'Senior Citizen ID',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Ilagay ang password',
      signInBtn: 'Magpatuloy',
      demoTitle: 'Maria Santos (Demo Account)',
      demoSub: 'SC-2024-0001 · Pindutin para mabilis na pumasok',
      speakHelp: 'Pakinggan ang gabay',
      helpSpeech:
        'Magandang araw Lola at Lolo! Ilagay ang inyong Senior ID at password, o pindutin ang Maria Santos Demo Account sa ibaba para makapasok agad.',
    };
  }
  if (language.value === 'english') {
    return {
      greeting: 'Good day,',
      headline: 'Sign in to Tala.',
      sub: 'Enter your Senior ID to view your LGU benefits and talk to Tala.',
      seniorIdLabel: 'Senior Citizen ID',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter your password',
      signInBtn: 'Sign In',
      demoTitle: 'Maria Santos (Demo Account)',
      demoSub: 'SC-2024-0001 · Tap for one-click sign in',
      speakHelp: 'Read instructions aloud',
      helpSpeech:
        'Good day Lola and Lolo! Enter your Senior Citizen ID and password, or tap the Maria Santos Demo Account card below to sign in right away.',
    };
  }
  return {
    greeting: 'Maayong adlaw,',
    headline: 'Sulod sa Tala.',
    sub: 'Ibutang ang imong Senior ID aron makita ang imong benepisyo ug maka-istorya ni Tala.',
    seniorIdLabel: 'Senior Citizen ID',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Ibutang ang imong password',
    signInBtn: 'Padayon',
    demoTitle: 'Maria Santos (Demo Account)',
    demoSub: 'SC-2024-0001 · Pinduta aron diretso makasulod',
    speakHelp: 'Paminawa ang giya',
    helpSpeech:
      'Maayong adlaw Lola ug Lolo! Ibutang ang imong Senior ID ug password, o pinduta ang Maria Santos Demo Account sa ubos aron diretso ka makasulod.',
  };
});

function fail(message: string) {
  errorMessage.value = message;
  showError.value = true;
  setTimeout(() => {
    showError.value = false;
  }, 3200);
}

async function login() {
  const id = seniorId.value.trim();
  const pw = password.value.trim();
  if (!id || !pw) {
    fail('Please enter both your Senior ID and password.');
    return;
  }

  isLoading.value = true;
  void ttsPlayer.stop();
  try {
    const user = await authService.login(id, pw);
    profileService.setCurrentUser(user.id);
    await router.replace('/app');
  } catch (e) {
    fail((e as Error).message.replace('Exception: ', ''));
  } finally {
    isLoading.value = false;
  }
}

async function quickDemoLogin() {
  seniorId.value = 'SC-2024-0001';
  password.value = 'demo';
  await login();
}

function speakInstructions() {
  void ttsPlayer.play(null, uiText.value.helpSpeech, language.value);
}
</script>

<template>
  <IonPage>
    <div class="tala-login">
      <!-- Top Bar matching AppShellView -->
      <header class="top">
        <div class="logo">
          <span class="mark">
            <svg viewBox="0 0 24 24">
              <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
            </svg>
          </span>
          Tala
        </div>

        <div class="top__actions">
          <div class="chip">
            <svg class="i"><use href="#check" /></svg>
            OSCA Portal
          </div>
          <button
            class="icon-pill"
            type="button"
            aria-label="Display & Language Settings"
            @click="settingsOpen = !settingsOpen"
          >
            <svg class="i"><use href="#menu" /></svg>
          </button>
        </div>
      </header>

      <!-- Main Stream matching AppShellView -->
      <section class="main fade-in">
        <div class="hello">
          <div class="hello__row">
            <span class="badge"><i />Senior Benefits Assistant</span>
            <button class="listen-chip" type="button" @click="speakInstructions">
              <svg class="i"><use href="#sound" /></svg>
              {{ uiText.speakHelp }}
            </button>
          </div>
          <h1>
            {{ uiText.greeting }}<br />
            <span class="grad">{{ uiText.headline }}</span>
          </h1>
          <p class="sub">{{ uiText.sub }}</p>
        </div>

        <!-- Login Card matching AppShellView .card/.group aesthetic -->
        <form class="card fade-up" @submit.prevent="login">
          <div class="head">
            <svg class="i"><use href="#award" /></svg>
            Senior Citizen Sign In
          </div>

          <div class="body">
            <label class="field" for="senior-id">
              <span class="field__label">{{ uiText.seniorIdLabel }}</span>
              <div class="field__row">
                <svg class="i field__icon"><use href="#user" /></svg>
                <input
                  id="senior-id"
                  v-model="seniorId"
                  type="text"
                  placeholder="SC-2024-0001"
                  autocomplete="username"
                />
              </div>
            </label>

            <label class="field" for="senior-pw">
              <span class="field__label">{{ uiText.passwordLabel }}</span>
              <div class="field__row">
                <svg class="i field__icon"><use href="#award" /></svg>
                <input
                  id="senior-pw"
                  v-model="password"
                  :type="obscure ? 'password' : 'text'"
                  :placeholder="uiText.passwordPlaceholder"
                  autocomplete="current-password"
                />
                <button
                  class="eye"
                  type="button"
                  aria-label="Toggle password visibility"
                  @click="obscure = !obscure"
                >
                  <IonIcon :icon="obscure ? eyeOffOutline : eyeOutline" />
                </button>
              </div>
            </label>
          </div>

          <button class="btn pri submit-btn" type="submit" :disabled="isLoading">
            <LoadingSpinner v-if="isLoading" :size="22" class="login-spinner" />
            <template v-else>
              {{ uiText.signInBtn }}
              <svg class="i"><use href="#go" /></svg>
            </template>
          </button>
        </form>

        <!-- One-Tap Demo Card styled like AppShellView .sugg -->
        <button
          class="sugg fade-up"
          type="button"
          :disabled="isLoading"
          @click="quickDemoLogin"
        >
          <span class="ava">MS</span>
          <span class="sugg__meta">
            <b>{{ uiText.demoTitle }}</b>
            <small>{{ uiText.demoSub }}</small>
          </span>
          <svg class="i go"><use href="#go" /></svg>
        </button>
      </section>

      <!-- Scrim & Settings Popover (Language + Text Size) -->
      <div class="scrim" :class="{ on: settingsOpen }" @click="settingsOpen = false" />
      <div class="pop" :class="{ on: settingsOpen }" role="dialog" aria-label="Settings">
        <div class="plabel">Text size</div>
        <div class="seg">
          <button
            type="button"
            style="font-size: 16px"
            :class="{ on: textSizeIndex === 0 }"
            @click="setTextSizeIndex(0 as TextSizeIndex)"
          >
            Aa
          </button>
          <button
            type="button"
            style="font-size: 20px"
            :class="{ on: textSizeIndex === 1 }"
            @click="setTextSizeIndex(1 as TextSizeIndex)"
          >
            Aa
          </button>
          <button
            type="button"
            style="font-size: 26px"
            :class="{ on: textSizeIndex === 2 }"
            @click="setTextSizeIndex(2 as TextSizeIndex)"
          >
            Aa
          </button>
        </div>

        <div class="plabel">Language</div>
        <div class="seg">
          <button
            v-for="lang in APP_LANGUAGES"
            :key="lang.id"
            type="button"
            style="font-size: 14px"
            :class="{ on: language === lang.id }"
            @click="setLanguage(lang.id as AppLanguage)"
          >
            {{ lang.nativeLabel }}
          </button>
        </div>
      </div>

      <!-- Toast Notification -->
      <div class="toast" :class="{ on: showError }">{{ errorMessage }}</div>
    </div>
  </IonPage>
</template>

<style scoped>
.tala-login {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  color: var(--ink);
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px 4px;
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 22px;
  letter-spacing: -0.02em;
}

.mark {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--grad);
  display: grid;
  place-items: center;
}

.mark svg {
  width: 22px;
  height: 22px;
  fill: #fff;
}

.top__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 18px;
  background: var(--glass);
  border: 1px solid var(--line);
  font-size: 14px;
  font-weight: 600;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.chip .i {
  width: 16px;
  height: 16px;
  color: #16a34a;
}

.icon-pill {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--glass);
  border: 1px solid var(--line);
  display: grid;
  place-items: center;
}

.icon-pill .i {
  width: 18px;
  height: 18px;
}

.main {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px calc(20px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 14px;
}

.hello {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hello__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 13px;
  border-radius: 17px;
  background: var(--hi);
  border: 1px solid var(--line);
  font-size: 13px;
  font-weight: 600;
}

.badge i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 10px #22c55e;
}

.listen-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: 17px;
  background: var(--solid);
  border: 1px solid var(--line);
  font-size: 13px;
  font-weight: 700;
  color: var(--a2);
}

.listen-chip .i {
  width: 16px;
  height: 16px;
}

h1 {
  font-size: calc(var(--fs) * 1.75);
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -0.035em;
  margin: 0;
}

.grad {
  background: linear-gradient(110deg, var(--ink) 10%, var(--a2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.sub {
  color: var(--muted);
  font-size: calc(var(--fs) * 0.82);
  line-height: 1.4;
}

/* Matches AppShellView .card */
.card {
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 26px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 12px 32px rgba(10, 20, 50, 0.08);
}

.card .head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 0;
  color: var(--muted);
  font-size: calc(var(--fs) * 0.76);
  font-weight: 600;
}

.card .head .i {
  width: 18px;
  height: 18px;
  color: var(--a2);
}

.card .body {
  background: var(--solid);
  border: 1px solid var(--line);
  border-radius: 20px;
  overflow: hidden;
}

.field {
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  cursor: text;
}

.field:first-child {
  border-top: 0;
}

.field:focus-within {
  background: var(--hi);
}

.field__label {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  margin-bottom: 4px;
}

.field__row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
}

.field__icon {
  width: 22px;
  height: 22px;
  color: var(--a2);
}

.field__row input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--fs);
  font-weight: 600;
  color: var(--ink);
  outline: none;
}

.field__row input::placeholder {
  color: var(--muted);
  font-weight: 400;
  opacity: 0.7;
}

.eye {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 22px;
  color: var(--muted);
}

.btn {
  min-height: 58px;
  border-radius: 20px;
  background: var(--glass);
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
  box-shadow: 0 10px 26px var(--glow);
}

.login-spinner {
  border-color: rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
}

/* Matches AppShellView .sugg & .ava */
.sugg {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  min-height: 70px;
  padding: 12px 16px;
  border-radius: 22px;
  background: var(--solid);
  border: 1px solid var(--line);
  font-size: var(--fs);
  box-shadow: 0 1px 2px rgba(10, 20, 50, 0.06), 0 8px 24px rgba(10, 20, 50, 0.1);
  transition: transform 0.15s, box-shadow 0.15s;
}

.sugg:active {
  transform: scale(0.985);
}

.ava {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--grad);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 16px;
  flex: none;
}

.sugg__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sugg__meta b {
  font-size: calc(var(--fs) * 0.88);
  font-weight: 700;
  color: var(--ink);
}

.sugg__meta small {
  font-size: calc(var(--fs) * 0.72);
  color: var(--muted);
  font-weight: 500;
}

.sugg .go {
  margin-left: auto;
  color: var(--a2);
  width: 22px;
  height: 22px;
}

/* Settings Popover matching AppShellView */
.scrim {
  position: absolute;
  inset: 0;
  background: rgba(3, 4, 8, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 7;
}

.scrim.on {
  opacity: 1;
  pointer-events: auto;
}

.pop {
  position: absolute;
  right: 14px;
  top: 56px;
  width: 290px;
  z-index: 9;
  background: var(--solid);
  border: 1px solid var(--line);
  border-radius: 26px;
  padding: 14px;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.35);
  transform-origin: top right;
  transform: scale(0.88) translateY(-8px);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity 0.15s;
}

.pop.on {
  transform: none;
  opacity: 1;
  pointer-events: auto;
}

.plabel {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  padding: 0 4px;
}

.seg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 5px;
  background: var(--hi);
  border-radius: 18px;
  margin: 4px 0 10px;
}

.seg:last-child {
  margin-bottom: 0;
}

.seg button {
  height: 44px;
  border-radius: 13px;
  font-weight: 700;
  color: var(--muted);
}

.seg button.on {
  background: var(--solid);
  color: var(--a2);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  outline: 1.5px solid var(--a2);
}

.toast {
  position: absolute;
  left: 50%;
  top: 64px;
  transform: translateX(-50%);
  background: var(--danger);
  color: #fff;
  padding: 12px 20px;
  border-radius: 24px;
  font-weight: 700;
  font-size: 15px;
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
