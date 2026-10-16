<script setup lang="ts">
import { IonIcon } from '@ionic/vue';

/** Round white icon button (e.g. the "?" notes button in the header). */
defineProps<{ icon: string; label?: string }>();
const emit = defineEmits<{ (e: 'tap'): void }>();
</script>

<template>
  <button class="circle-btn btn-reset tappable" :aria-label="label" @click="emit('tap')">
    <IonIcon :icon="icon" />
  </button>
</template>

<style scoped>
.circle-btn {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--c-ink);
}
</style>
