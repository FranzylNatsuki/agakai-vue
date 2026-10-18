<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BenefitsHeader from '@/components/benefits/BenefitsHeader.vue';
import BenefitCard from '@/components/benefits/BenefitCard.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import { localizeBenefit, type Benefit } from '@/models/benefit';
import { benefitService } from '@/services/benefitService';
import { profileService } from '@/services/profileService';
import { useSettings } from '@/composables/useSettings';

/**
 * `highlightBenefitId` = benefit tapped on the Home tab; this view scrolls to
 * it and flashes its border for ~2.5s.
 */
const props = defineProps<{ highlightBenefitId?: string | null }>();
const emit = defineEmits<{ (e: 'back'): void }>();
const { t, language } = useSettings();

const benefits = ref<Benefit[]>([]);
const localizedBenefits = computed(() => {
  const localeCode = language.value === 'cebuano' ? 'ceb' : language.value === 'tagalog' ? 'tl' : 'en';
  return benefits.value.map((benefit) => localizeBenefit(benefit, localeCode));
});
const loading = ref(true);
const error = ref('');
const highlightedId = ref<string | null>(null);
const scroller = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

onMounted(async () => {
  try {
    const profile = await profileService.loadProfileOrNull();
    benefits.value = await benefitService.loadRelevantBenefits(profile?.address);
  } catch {
    error.value = 'error';
  } finally {
    loading.value = false;
    highlight();
  }
});

onBeforeUnmount(() => clearTimeout(timer));

async function highlight() {
  const id = props.highlightBenefitId;
  if (!id || benefits.value.length === 0) return;
  await nextTick();
  const el = scroller.value?.querySelector<HTMLElement>(`[data-benefit-id="${CSS.escape(id)}"]`);
  if (!el) return;
  highlightedId.value = id;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  clearTimeout(timer);
  timer = setTimeout(() => (highlightedId.value = null), 2500);
}

watch(() => props.highlightBenefitId, highlight);
</script>

<template>
  <div class="benefits">
    <BenefitsHeader @back="emit('back')" />

    <div ref="scroller" class="benefits__scroll">
      <div v-if="loading" class="benefits__center"><LoadingSpinner /></div>
      <p v-else-if="error" class="benefits__error">{{ t('error_loading_benefits') }}</p>
      <p v-else-if="benefits.length === 0" class="benefits__center">{{ t('no_benefits') }}</p>
      <div v-else class="benefits__list">
        <div
          v-for="(b, i) in localizedBenefits"
          :key="b.id"
          class="benefits__item fade-in"
          :style="{ animationDuration: `${250 + i * 60}ms` }"
          :data-benefit-id="b.id"
        >
          <BenefitCard :benefit="b" :highlighted="b.id === highlightedId" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.benefits {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--c-slate-50);
}
.benefits__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px;
}
.benefits__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.benefits__center {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
.benefits__error {
  text-align: center;
  color: #f44336;
}
</style>
