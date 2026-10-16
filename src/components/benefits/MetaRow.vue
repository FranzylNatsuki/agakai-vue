<script setup lang="ts">
import { IonIcon } from '@ionic/vue';

defineProps<{ icon: string; label: string }>();
</script>

<template>
  <div class="meta-row">
    <IonIcon class="meta-row__icon" :icon="icon" />
    <span class="meta-row__label">{{ label }}</span>
  </div>
</template>

<style scoped>
.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.meta-row__icon {
  font-size: 16px;
  color: var(--c-slate-500);
  flex-shrink: 0;
}
.meta-row__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--c-slate-700);
}
</style>
