<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { bus, card, cash, chevronForward, medkit, restaurant } from 'ionicons/icons';
import { benefitIconName, type Benefit } from '@/models/benefit';

/** Compact benefit row shown on the Home tab. */
const props = defineProps<{ benefit: Benefit }>();
const emit = defineEmits<{ (e: 'tap', benefit: Benefit): void }>();

const ICONS = { cash, medkit, restaurant, bus, card };
const icon = computed(() => ICONS[benefitIconName(props.benefit.iconKey)]);
</script>

<template>
  <button class="benefit-item btn-reset tappable" @click="emit('tap', benefit)">
    <span class="benefit-item__icon"><IonIcon :icon="icon" /></span>
    <span class="benefit-item__text">
      <span class="benefit-item__title">{{ benefit.title }}</span>
      <span class="benefit-item__meta">{{ benefit.dateAndLocation }}</span>
    </span>
    <IonIcon class="benefit-item__chevron" :icon="chevronForward" />
  </button>
</template>

<style scoped>
.benefit-item {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 14px;
  box-sizing: border-box;
  text-align: left;
  background: #fff;
  border: 2px solid var(--c-slate-border);
  border-radius: 20px;
  box-shadow: 0 2px 3px rgba(15, 23, 42, 0.03);
}
.benefit-item__icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--c-benefit-green);
  color: #fff;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.benefit-item__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.benefit-item__title,
.benefit-item__meta {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.benefit-item__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--c-ink);
}
.benefit-item__meta {
  font-size: 0.8125rem;
  color: var(--c-slate-text);
}
.benefit-item__chevron {
  font-size: 22px;
  color: var(--c-slate-400);
}
</style>
