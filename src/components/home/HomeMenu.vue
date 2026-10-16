<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { languageOutline, logOutOutline, personOutline, textOutline } from 'ionicons/icons';
import MenuRow from '@/components/home/MenuRow.vue';
import SegmentedToggle from '@/components/common/SegmentedToggle.vue';
import { APP_LANGUAGES, useSettings, type AppLanguage } from '@/composables/useSettings';

/** Animated dropdown below the greeting: Profile, Language, Text size, Log out. */
defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'profile'): void; (e: 'logout'): void }>();

const { t, language, largeText, setLanguage, setLargeText } = useSettings();

const languageOptions = APP_LANGUAGES.map((l) => ({ value: l.id, label: l.nativeLabel }));
</script>

<template>
  <!-- grid-rows trick animates height from 0 → auto -->
  <div class="home-menu" :class="{ 'home-menu--open': open }">
    <div class="home-menu__clip">
      <div class="home-menu__inner">
        <div class="home-menu__divider" />

        <MenuRow
          :icon="personOutline"
          :title="t('profile')"
          :subtitle="t('view_details')"
          @tap="emit('profile')"
        />

        <div class="home-menu__row home-menu__row--between">
          <div class="home-menu__label-wrap">
            <IonIcon class="home-menu__icon" :icon="languageOutline" />
            <span class="home-menu__label">{{ t('language') }}</span>
          </div>
          <SegmentedToggle
            :model-value="language"
            :options="languageOptions"
            @update:model-value="(v: AppLanguage) => setLanguage(v)"
          />
        </div>

        <div class="home-menu__row">
          <IonIcon class="home-menu__icon" :icon="textOutline" />
          <div class="home-menu__stack">
            <span class="home-menu__label">{{ t('text_size') }}</span>
            <SegmentedToggle
              :model-value="largeText"
              :radius="8"
              :options="[
                { value: false, label: t('text_size_standard') },
                { value: true, label: t('text_size_enlarged') },
              ]"
              @update:model-value="(v: boolean) => setLargeText(v)"
            />
          </div>
        </div>

        <MenuRow
          destructive
          :icon="logOutOutline"
          :title="t('log_out')"
          :subtitle="t('sign_out')"
          @tap="emit('logout')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-menu {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 0.28s cubic-bezier(0.215, 0.61, 0.355, 1), opacity 0.28s ease;
}
.home-menu--open {
  grid-template-rows: 1fr;
  opacity: 1;
}
.home-menu__clip {
  overflow: hidden;
  min-height: 0;
}
.home-menu__divider {
  height: 1px;
  background: var(--c-slate-200);
}
.home-menu__row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--c-slate-100);
}
.home-menu__row--between {
  justify-content: space-between;
}
.home-menu__label-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
}
.home-menu__icon {
  font-size: 22px;
  color: #093582;
}
.home-menu__label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--c-forest-dark);
}
.home-menu__stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
</style>
