<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { arrowForward, bus, calendar, card, cash, location, medkit, restaurant } from 'ionicons/icons';
import MetaRow from '@/components/benefits/MetaRow.vue';
import { benefitIconName, type Benefit } from '@/models/benefit';

/** Full benefit card (title, date/location, description, claim button). */
const props = defineProps<{ benefit: Benefit; highlighted?: boolean }>();
const emit = defineEmits<{ (e: 'claim', benefit: Benefit): void }>();

const ICONS = { cash, medkit, restaurant, bus, card };
const icon = computed(() => ICONS[benefitIconName(props.benefit.iconKey)]);

/** dateAndLocation is "date • location" — split it back apart. */
const parts = computed(() =>
  props.benefit.dateAndLocation
    .split('•')
    .map((e) => e.trim())
    .filter(Boolean),
);
const date = computed(() => parts.value[0] ?? '');
const place = computed(() => parts.value[1] ?? '');
</script>

<template>
  <article class="b-card" :class="{ 'b-card--highlighted': highlighted }">
    <div class="b-card__head">
      <div class="b-card__title-wrap">
        <span class="b-card__accent" />
        <h3 class="b-card__title">{{ benefit.title }}</h3>
      </div>
      <span class="b-card__icon"><IonIcon :icon="icon" /></span>
    </div>

    <div class="b-card__divider" />

    <div class="b-card__body">
      <MetaRow v-if="date" :icon="calendar" :label="date" />
      <MetaRow v-if="place" :icon="location" :label="place" />

      <p v-if="benefit.description" class="b-card__desc">{{ benefit.description }}</p>

      <!-- TODO(backend): hook up "How To Claim" -->
      <button class="btn-reset b-card__claim tappable" @click="emit('claim', benefit)">
        How To Claim <IonIcon :icon="arrowForward" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.b-card {
  overflow: hidden;
  background: #fff;
  border: 1.5px solid var(--c-slate-200);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}
.b-card--highlighted {
  border: 2.5px solid var(--c-focus-blue);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}
.b-card__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 16px 12px;
}
.b-card__title-wrap {
  flex: 1;
  display: flex;
  align-items: flex-start;
}
.b-card__accent {
  width: 4px;
  height: 24px;
  margin: 2px 10px 0 0;
  border-radius: 2px;
  background: #093582;
  flex-shrink: 0;
}
.b-card__title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1.25;
  color: var(--c-ink);
}
.b-card__icon {
  padding: 10px;
  border-radius: 12px;
  background: var(--c-blue-50);
  color: #093582;
  font-size: 22px;
  display: flex;
}
.b-card__divider {
  height: 1px;
  background: var(--c-slate-100);
}
.b-card__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}
.b-card__desc {
  margin: 4px 0 0;
  padding: 12px;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--c-slate-text);
  background: var(--c-slate-50);
  border-radius: 8px;
  border-left: 3px solid var(--c-slate-border);
}
.b-card__claim {
  margin-top: 8px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 10px;
  background: #093582;
  color: #fff;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.b-card__claim ion-icon {
  font-size: 16px;
}
</style>
