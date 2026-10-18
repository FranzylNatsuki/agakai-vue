<script setup lang="ts">
import { ref } from 'vue';
import { IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import {
  APP_LANGUAGES,
  TEXT_SIZES,
  useSettings,
  type AppLanguage,
  type TextSizeIndex,
} from '@/composables/useSettings';
import { voiceRecorder } from '@/services/voiceRecorder';

const router = useRouter();
const { language, textSizeIndex, setLanguage, setTextSizeIndex, t } = useSettings();
const busy = ref(false);
const microphoneReady = ref(false);
const status = ref('');

async function enableMicrophone() {
  busy.value = true;
  status.value = '';
  microphoneReady.value = await voiceRecorder.requestPermission();
  status.value = t(microphoneReady.value ? 'onboarding_mic_ready' : 'onboarding_mic_denied');
  busy.value = false;
}

async function continueToLogin() {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('agakai_onboarding_complete_v2', '1');
    // The permission explanation was already shown here.
    localStorage.setItem('agakai_mic_primer_seen', '1');
  }
  await router.replace('/login');
}
</script>

<template>
  <IonPage>
    <main class="onboarding">
      <section class="onboarding__card fade-up">
        <img class="onboarding__logo" src="/assets/logo.png?v=repair2" alt="AgakAI" />
        <h1>{{ t('onboarding_title') }}</h1>

        <fieldset class="onboarding__group">
          <legend>{{ t('choose_language') }}</legend>
          <div class="onboarding__languages">
            <button
              v-for="option in APP_LANGUAGES"
              :key="option.id"
              class="onboarding__choice"
              :class="{ selected: language === option.id }"
              type="button"
              :aria-pressed="language === option.id"
              @click="setLanguage(option.id as AppLanguage)"
            >{{ option.nativeLabel }}</button>
          </div>
        </fieldset>

        <fieldset class="onboarding__group">
          <legend>{{ t('text_size') }}</legend>
          <div class="onboarding__sizes">
            <button
              v-for="index in [0, 1, 2]"
              :key="index"
              class="onboarding__choice"
              :class="{ selected: textSizeIndex === index }"
              :aria-pressed="textSizeIndex === index"
              :style="{ fontSize: `${TEXT_SIZES[index] * 0.7}px` }"
              type="button"
              @click="setTextSizeIndex(index as TextSizeIndex)"
            >{{ t(index === 0 ? 'text_size_standard' : index === 1 ? 'text_size_enlarged' : 'text_size_largest') }}</button>
          </div>
        </fieldset>

        <section class="onboarding__group">
          <h2>{{ t('onboarding_voice_title') }}</h2>
          <p class="onboarding__hint">{{ t('onboarding_mic_explainer') }}</p>
          <button
            class="onboarding__secondary"
            :disabled="busy || microphoneReady"
            type="button"
            @click="enableMicrophone"
          >{{ microphoneReady ? t('onboarding_mic_ready') : busy ? t('onboarding_requesting_permission') : t('onboarding_enable_microphone') }}</button>
          <p v-if="status && !microphoneReady" class="onboarding__status" role="status">{{ status }}</p>
          <p class="onboarding__hint">{{ t('onboarding_no_other_permissions') }}</p>
        </section>

        <button class="onboarding__primary" type="button" :disabled="busy" @click="continueToLogin">
          {{ t('onboarding_continue_to_login') }}
        </button>
      </section>
    </main>
  </IonPage>
</template>

<style scoped>
.onboarding {
  display: grid;
  min-height: 100%;
  place-items: center;
  padding: 20px 16px calc(20px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  color: var(--ink);
}
.onboarding__card {
  width: min(100%, 480px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--glass);
  box-shadow: 0 12px 32px rgba(10, 20, 50, 0.08);
}
.onboarding__logo {
  width: min(170px, 52%);
  height: auto;
  object-fit: contain;
  align-self: center;
}
.onboarding h1 {
  margin: 0;
  text-align: center;
  color: var(--ink);
  font-size: clamp(1.45rem, 5vw, 1.8rem);
}
.onboarding__group {
  display: grid;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.onboarding__group legend,
.onboarding__group h2 {
  margin: 0 0 2px;
  padding: 0;
  color: var(--ink);
  font-size: 1rem;
  font-weight: 700;
}
.onboarding__group h2 { font-size: 1.05rem; }
.onboarding__languages,
.onboarding__sizes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.onboarding__choice,
.onboarding__primary,
.onboarding__secondary {
  min-height: 48px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--solid);
  color: var(--ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.onboarding__choice.selected,
.onboarding__primary {
  border-color: transparent;
  background: var(--grad);
  color: #fff;
}
.onboarding__primary { min-height: 54px; }
.onboarding__hint,
.onboarding__status {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.4;
}
.onboarding__status { color: var(--a2); font-weight: 600; }
.onboarding__secondary:disabled,
.onboarding__primary:disabled { opacity: 0.65; cursor: default; }
@media (prefers-reduced-motion: reduce) {
  .onboarding :deep(*) { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
</style>
