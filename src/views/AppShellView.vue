<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { IonPage } from '@ionic/vue';
import { App as CapApp } from '@capacitor/app';
import AppBottomNav from '@/components/common/AppBottomNav.vue';
import HomeView from '@/views/HomeView.vue';
import VoiceAssistantView from '@/views/VoiceAssistantView.vue';
import BenefitsView from '@/views/BenefitsView.vue';
import type { Benefit } from '@/models/benefit';

/** Tab indices: 0 Home / Balay, 1 Voice / Tingog, 2 Benefits */
const selected = ref(0);
const highlightBenefitId = ref<string | null>(null);

function goTo(index: number) {
  selected.value = index;
}

/** Open the Benefits tab and jump to the tapped benefit. */
function openBenefit(benefit: Benefit) {
  highlightBenefitId.value = benefit.id;
  selected.value = 2;
}

// Android hardware back: from any tab go Home; exit only from Home.
let removeBackListener: (() => void) | undefined;
onMounted(async () => {
  const handle = await CapApp.addListener('backButton', () => {
    if (selected.value !== 0) goTo(0);
    else CapApp.exitApp();
  }).catch(() => null);
  removeBackListener = () => handle?.remove();
});
onBeforeUnmount(() => removeBackListener?.());
</script>

<template>
  <IonPage>
    <div class="shell">
      <!-- v-show keeps every tab alive so state is preserved across switches -->
      <main class="shell__pages">
        <section v-show="selected === 0" class="shell__page tab-fade">
          <HomeView
            @open-benefits="goTo(2)"
            @view-all-benefits="goTo(2)"
            @open-voice="goTo(1)"
            @open-benefit="openBenefit"
          />
        </section>
        <section v-show="selected === 1" class="shell__page tab-fade">
          <VoiceAssistantView @back="goTo(0)" />
        </section>
        <section v-show="selected === 2" class="shell__page tab-fade">
          <BenefitsView :highlight-benefit-id="highlightBenefitId" @back="goTo(0)" />
        </section>
      </main>

      <!-- Hidden on the voice tab (it has its own mic dock) -->
      <AppBottomNav v-if="selected !== 1" :current-index="selected" @tap="goTo" />
    </div>
  </IonPage>
</template>

<style scoped>
.shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--c-page-bg);
}
.shell__pages {
  flex: 1;
  min-height: 0;
  position: relative;
}
.shell__page {
  position: absolute;
  inset: 0;
}
.tab-fade {
  animation: tab-fade 0.28s ease-out;
}
@keyframes tab-fade {
  from { opacity: 0.35; }
  to { opacity: 1; }
}
</style>
