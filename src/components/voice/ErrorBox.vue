<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { alertCircleOutline, refresh } from 'ionicons/icons';

defineProps<{ message: string }>();
const emit = defineEmits<{ (e: 'retry'): void }>();
</script>

<template>
  <div class="error-box fade-in">
    <IonIcon class="error-box__icon" :icon="alertCircleOutline" />
    <p class="error-box__msg">{{ message }}</p>
    <button class="btn-reset error-box__retry tappable" @click="emit('retry')">
      <IonIcon :icon="refresh" /> Try again
    </button>
  </div>
</template>

<style scoped>
.error-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: #fff1f0;
  border: 1px solid #f3c1be;
  border-radius: 14px;
  animation-duration: 0.2s;
}
.error-box__icon {
  font-size: 26px;
  color: #b3261e;
}
.error-box__msg {
  margin: 8px 0 10px;
  text-align: center;
  font-size: 0.875rem;
  color: #8c1d18;
}
.error-box__retry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid var(--c-mid-blue);
  border-radius: 12px;
  color: var(--c-mid-blue);
  font-weight: 500;
}
.error-box__retry ion-icon {
  font-size: 18px;
}
</style>
