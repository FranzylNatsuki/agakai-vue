<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { chevronForward } from 'ionicons/icons';

/** Tappable suggested-question card. */
defineProps<{ title: string; subtitle: string }>();
const emit = defineEmits<{ (e: 'tap'): void }>();
</script>

<template>
  <button class="q-btn btn-reset tappable" @click="emit('tap')">
    <span class="q-btn__text">
      <span class="q-btn__title">{{ title }}</span>
      <span class="q-btn__sub">{{ subtitle }}</span>
    </span>
    <IonIcon class="q-btn__chevron" :icon="chevronForward" />
  </button>
</template>

<style scoped>
.q-btn {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 14px;
  box-sizing: border-box;
  text-align: left;
  background: #fff;
  border: 2px solid var(--c-slate-border);
  border-radius: 20px;
  box-shadow: 0 4px 4px rgba(0, 0, 0, 0.03);
}
.q-btn__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.q-btn__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--c-ink);
}
.q-btn__sub {
  font-size: 0.875rem;
  color: var(--c-slate-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.q-btn__chevron {
  font-size: 24px;
  color: var(--c-slate-text);
}
</style>
