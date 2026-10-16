<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { arrowBack } from 'ionicons/icons';

/**
 * White header bar with back arrow, title + subtitle and an optional
 * trailing action (slot). Used on the Voice Assistant screen.
 */
defineProps<{ title: string; subtitle: string }>();
const emit = defineEmits<{ (e: 'back'): void }>();
</script>

<template>
  <header class="screen-header">
    <button class="btn-reset screen-header__back tappable" aria-label="Back" @click="emit('back')">
      <IonIcon :icon="arrowBack" />
    </button>
    <div class="screen-header__text">
      <h1 class="headline screen-header__title">{{ title }}</h1>
      <p class="screen-header__subtitle">{{ subtitle }}</p>
    </div>
    <slot name="trailing" />
  </header>
</template>

<style scoped>
.screen-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: calc(16px + var(--ion-safe-area-top, 0px)) 24px 16px;
  background: #fff;
  border-bottom: 1px solid var(--c-hairline);
}
.screen-header__back {
  padding: 6px;
  border-radius: 12px;
  font-size: 24px;
  color: var(--c-ink);
  display: flex;
}
.screen-header__text {
  flex: 1;
  min-width: 0;
}
.screen-header__title {
  margin: 0;
  font-size: 1.625rem;
}
.screen-header__subtitle {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: var(--c-navy);
}
</style>
