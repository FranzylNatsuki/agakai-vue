<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { chevronForward } from 'ionicons/icons';

/** A tappable row in the home dropdown menu (icon, title, hint, chevron). */
defineProps<{
  icon: string;
  title: string;
  subtitle: string;
  destructive?: boolean;
}>();
const emit = defineEmits<{ (e: 'tap'): void }>();
</script>

<template>
  <button class="menu-row btn-reset tappable" :class="{ 'menu-row--danger': destructive }" @click="emit('tap')">
    <IonIcon class="menu-row__icon" :icon="icon" />
    <span class="menu-row__title">{{ title }}</span>
    <span class="menu-row__subtitle">{{ subtitle }}</span>
    <IonIcon class="menu-row__chevron" :icon="chevronForward" />
  </button>
</template>

<style scoped>
.menu-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 12px 16px;
  box-sizing: border-box;
  text-align: left;
  border-bottom: 1px solid var(--c-slate-100);
  color: var(--c-forest-dark);
}
.menu-row__icon {
  font-size: 22px;
  color: #093582;
}
.menu-row__title {
  flex: 1;
  font-size: 0.9375rem;
  font-weight: 600;
}
.menu-row__subtitle {
  font-size: 0.8125rem;
  color: var(--c-slate-500);
}
.menu-row__chevron {
  margin-left: -8px;
  font-size: 18px;
  color: var(--c-slate-400);
}
.menu-row--danger,
.menu-row--danger .menu-row__icon {
  color: #f44336;
}
.menu-row--danger .menu-row__subtitle {
  color: rgba(244, 67, 54, 0.7);
}
.menu-row--danger .menu-row__chevron {
  color: rgba(244, 67, 54, 0.5);
}
</style>
