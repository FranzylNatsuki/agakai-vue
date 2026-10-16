<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { close, menu, person } from 'ionicons/icons';

/** Avatar + greeting + hamburger/close button. */
defineProps<{
  greetingPrefix: string;
  userName: string;
  subtitle: string;
  menuExpanded: boolean;
}>();
const emit = defineEmits<{ (e: 'menu'): void }>();
</script>

<template>
  <div class="greeting">
    <!-- Gender-neutral avatar: gradient circle + person silhouette -->
    <div class="greeting__avatar"><IonIcon :icon="person" /></div>
    <div class="greeting__text">
      <div class="greeting__title">{{ greetingPrefix }} {{ userName }}!</div>
      <div class="greeting__subtitle">{{ subtitle }}</div>
    </div>
    <button class="btn-reset greeting__menu tappable" aria-label="Menu" @click="emit('menu')">
      <IonIcon :icon="menuExpanded ? close : menu" />
    </button>
  </div>
</template>

<style scoped>
.greeting {
  display: flex;
  align-items: center;
  gap: 12px;
}
.greeting__avatar {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 50%;
  box-sizing: border-box;
  border: 2.6px solid #fff;
  background: linear-gradient(to bottom, #093582, #0284c7);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.13);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  color: #fff;
}
.greeting__text {
  flex: 1;
  min-width: 0;
}
.greeting__title {
  font-size: 1.1875rem;
  font-weight: 800;
  color: var(--c-forest-dark);
}
.greeting__subtitle {
  margin-top: 2px;
  font-size: 0.75rem;
  color: var(--c-forest-body);
}
.greeting__menu {
  padding: 8px;
  font-size: 28px;
  color: var(--c-forest-dark);
  display: flex;
}
</style>
