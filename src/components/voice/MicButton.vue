<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { mic, stop } from 'ionicons/icons';

const props = defineProps<{ listening: boolean }>();
const emit = defineEmits<{ (e: 'tap'): void }>();
</script>

<template>
  <button
    class="mic btn-reset"
    :class="props.listening ? 'mic--listening' : 'mic--idle'"
    :aria-label="props.listening ? 'Stop listening' : 'Start speaking'"
    :aria-pressed="props.listening"
    type="button"
    @click="emit('tap')"
  >
    <IonIcon :icon="props.listening ? stop : mic" aria-hidden="true" />
  </button>
</template>

<style scoped>
.mic {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  border: 2px solid var(--a2);
  border-radius: 50%;
  background: var(--a2);
  color: #fff;
  font-size: 40px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.mic--listening {
  border-color: var(--brand-slate);
  background: var(--brand-slate);
}

.mic:focus-visible {
  outline: 3px solid var(--brand-slate);
  outline-offset: 4px;
}
</style>
