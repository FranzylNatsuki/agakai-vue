<script setup lang="ts">
import MicButton from '@/components/voice/MicButton.vue';

/** Fixed bottom bar: mic button + status label (shared by all voice states). */
defineProps<{ listening: boolean; label: string }>();
const emit = defineEmits<{ (e: 'micTap'): void }>();
</script>

<template>
  <div class="mic-dock">
    <MicButton :listening="listening" @tap="emit('micTap')" />
    <!-- :key makes the label softly re-fade whenever the text changes -->
    <p :key="label" class="mic-dock__label fade-in">{{ label }}</p>
  </div>
</template>

<style scoped>
.mic-dock {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 24px calc(12px + var(--ion-safe-area-bottom, 0px));
  background: #fff;
  border-top: 1px solid #edeff2;
}
.mic-dock__label {
  margin: 12px 0 0;
  text-align: center;
  font-size: 1.0625rem;
  font-weight: 700;
  animation-duration: 0.25s;
}
</style>
