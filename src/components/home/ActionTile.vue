<script setup lang="ts">
import { IonIcon } from '@ionic/vue';

/** Large colored shortcut tile (Voice Assistant / My Benefits). */
defineProps<{
  title: string;
  subtitle: string;
  icon: string;
  bgColor: string;
  accentColor: string;
  textColor: string;
}>();
const emit = defineEmits<{ (e: 'tap'): void }>();
</script>

<template>
  <button class="action-tile btn-reset tappable" :style="{ background: bgColor }" @click="emit('tap')">
    <span class="action-tile__icon" :style="{ background: accentColor }"><IonIcon :icon="icon" /></span>
    <span class="action-tile__title" :style="{ color: textColor }">{{ title }}</span>
    <span class="action-tile__subtitle" :style="{ color: textColor }">{{ subtitle }}</span>
  </button>
</template>

<style scoped>
.action-tile {
  width: 100%;
  min-height: 150px;
  padding: 16px;
  box-sizing: border-box;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.action-tile__icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  color: #fff;
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.action-tile__title {
  font-size: 0.9375rem;
  font-weight: 800;
}
.action-tile__subtitle {
  margin-top: 2px;
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.8;
}
</style>
