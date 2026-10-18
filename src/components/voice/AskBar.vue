<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { arrowForward, keypadOutline } from 'ionicons/icons';
import { useSettings } from '@/composables/useSettings';

/** Text input so seniors who prefer typing (or with no mic) can ask. */
defineProps<{ modelValue: string }>();
const { t } = useSettings();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'submit', v: string): void }>();
</script>

<template>
  <div class="ask-bar">
    <IonIcon class="ask-bar__icon" :icon="keypadOutline" />
    <input
      class="ask-bar__input"
      type="text"
      enterkeyhint="send"
      :placeholder="t('type_question')"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keyup.enter="emit('submit', modelValue)"
    />
    <button
      class="btn-reset ask-bar__send tappable"
      type="button"
      :aria-label="t('ask_agak')"
      @click="emit('submit', modelValue)"
    >
      <IonIcon :icon="arrowForward" aria-hidden="true" />
      <span>{{ t('ask_agak') }}</span>
    </button>
  </div>
</template>

<style scoped>
.ask-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 0 16px;
  box-sizing: border-box;
  border: 2.5px solid var(--c-focus-blue);
  border-radius: 20px;
}
.ask-bar__icon {
  font-size: 24px;
  color: var(--c-slate-text);
}
.ask-bar__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 1.125rem;
  color: var(--c-ink);
}
.ask-bar__input::placeholder {
  color: var(--c-slate-text);
}
.ask-bar__send {
  min-height: 48px;
  padding: 0 12px;
  flex-shrink: 0;
  gap: 6px;
  border-radius: 16px;
  background: var(--a2);
  color: #fff;
  font-size: calc(14px * var(--text-scale, 1));
  font-weight: 700;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ask-bar__send ion-icon {
  font-size: 18px;
}
</style>
