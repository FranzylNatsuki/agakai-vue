<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { home, mic, ribbon } from 'ionicons/icons';

/** Bottom navigation: Home / Voice (floating mic) / Benefits. */
defineProps<{ currentIndex: number }>();
const emit = defineEmits<{ (e: 'tap', index: number): void }>();

const tabs = [
  { icon: home, top: 'Home', bottom: 'Balay' },
  { icon: mic, top: 'Voice', bottom: 'Tingog' },
  { icon: ribbon, top: 'Benefits', bottom: null },
];
const label = (t: (typeof tabs)[number]) => (t.bottom ? `${t.top} / ${t.bottom}` : t.top);
</script>

<template>
  <nav class="bottom-nav">
    <div class="bottom-nav__bar">
      <button
        v-for="(tab, i) in tabs"
        :key="i"
        class="btn-reset bottom-nav__tab tappable"
        @click="emit('tap', i)"
      >
        <!-- Center tab reserves room for the floating mic -->
        <span v-if="i === 1" class="bottom-nav__spacer" />
        <span
          v-else
          class="bottom-nav__pill"
          :class="{ 'bottom-nav__pill--active': i === currentIndex }"
        >
          <IonIcon :icon="tab.icon" />
        </span>
        <span
          class="bottom-nav__label"
          :class="{ 'bottom-nav__label--bold': i === 1 || i === currentIndex }"
        >
          {{ label(tab) }}
        </span>
      </button>
    </div>

    <button class="btn-reset bottom-nav__mic" aria-label="Voice assistant" @click="emit('tap', 1)">
      <IonIcon :icon="mic" />
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: relative;
  flex-shrink: 0;
  background: #fff;
}
.bottom-nav__bar {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px calc(8px + var(--ion-safe-area-bottom, 0px));
  background: #fff;
  border-top: 2px solid #d2e2ff;
}
.bottom-nav__tab {
  flex: 1;
  height: 64px;
  margin: 0 2px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  color: var(--c-navy);
}
.bottom-nav__spacer {
  height: 38px;
}
.bottom-nav__pill {
  width: 100%;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  transition: background 0.25s ease;
}
.bottom-nav__pill--active {
  background: var(--c-sky-blue-bg);
}
.bottom-nav__label {
  margin-top: 4px;
  max-width: 100%;
  font-size: 0.6875rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bottom-nav__label--bold {
  font-weight: 700;
}
.bottom-nav__mic {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: var(--c-navy);
  color: #fff;
  border: 3.5px solid #fff;
  box-shadow: 0 4px 10px rgba(9, 53, 130, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
}
</style>
