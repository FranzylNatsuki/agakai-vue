<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { arrowBack } from 'ionicons/icons';

/** Compact white header for the My Benefits tab. */
const emit = defineEmits<{ (e: 'back'): void }>();
</script>

<template>
  <header class="b-header">
    <button class="btn-reset b-header__back tappable" aria-label="Back" @click="emit('back')">
      <IonIcon :icon="arrowBack" />
    </button>
    <div class="b-header__text">
      <h1 class="b-header__title">My Benefits</h1>
      <p class="b-header__subtitle">Akong mga Benepisyo ug Pribilehiyo</p>
    </div>
  </header>
</template>

<style scoped>
.b-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 80px;
  padding: calc(8px + var(--ion-safe-area-top, 0px)) 12px 8px;
  box-sizing: border-box;
  background: #fff;
  border-bottom: 1px solid var(--c-slate-200);
}
.b-header__back {
  padding: 12px;
  font-size: 24px;
  color: var(--c-ink);
  display: flex;
}
.b-header__title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: var(--c-ink);
}
.b-header__subtitle {
  margin: 2px 0 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #093582;
}
</style>
