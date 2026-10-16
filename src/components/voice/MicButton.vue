<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { mic } from 'ionicons/icons';

/**
 * Big mic button. Idle: gentle "breathing". Listening: color pulse, and the
 * button grows up to ~22% with the live voice level (dB).
 */
const props = defineProps<{ listening: boolean; soundLevel?: number }>();
const emit = defineEmits<{ (e: 'tap'): void }>();

/** Recorder levels run ~ -60 dB (quiet) … -5 dB (loud) → 0..1. */
const level = computed(() => Math.min(1, Math.max(0, ((props.soundLevel ?? 0) + 50) / 50)));
const scale = computed(() => (props.listening ? 1 + 0.22 * level.value : 1));
</script>

<template>
  <button
    class="mic btn-reset"
    :class="listening ? 'mic--listening' : 'mic--idle'"
    aria-label="Microphone"
    @click="emit('tap')"
  >
    <span class="mic__scale" :style="{ transform: `scale(${scale})` }">
      <span class="mic__outer">
        <span class="mic__inner"><IonIcon :icon="mic" /></span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.mic {
  display: block;
}
.mic__scale {
  display: block;
  transition: transform 0.14s ease-out;
}
.mic__outer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 146px;
  height: 160px;
  border-radius: 76px;
  background: var(--c-pale-blue-bg);
  box-shadow: 0 4px 2px rgba(0, 0, 0, 0.25);
}
.mic__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 106px;
  height: 116px;
  box-sizing: border-box;
  border-radius: 55px;
  border: 3.4px solid #fff;
  background: var(--c-bright-blue);
  color: #fff;
  font-size: 46px;
}

.mic--idle .mic__scale {
  animation: breathe 2.4s ease-in-out infinite alternate;
}
.mic--listening .mic__outer {
  animation: pulse-outer 0.9s ease-in-out infinite alternate;
}
.mic--listening .mic__inner {
  animation: pulse-inner 0.9s ease-in-out infinite alternate;
}

@keyframes breathe {
  from { transform: scale(1); }
  to { transform: scale(1.015); }
}
@keyframes pulse-outer {
  from { background: var(--c-pale-blue-bg); }
  to { background: var(--c-sky-blue-bg); }
}
@keyframes pulse-inner {
  from { background: var(--c-bright-blue); }
  to { background: var(--c-mid-blue); }
}
</style>
