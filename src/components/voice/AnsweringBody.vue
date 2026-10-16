<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { checkmarkCircleOutline, mic } from 'ionicons/icons';
import MarkdownContent from '@/components/common/MarkdownContent.vue';
import ThinkingIndicator from '@/components/voice/ThinkingIndicator.vue';
import ThinkingDot from '@/components/voice/ThinkingDot.vue';
import ErrorBox from '@/components/voice/ErrorBox.vue';

/** Question bubble + live streaming answer; auto-scrolls while it grows. */
const props = defineProps<{
  question: string;
  answer: string;
  done: boolean;
  error: boolean;
  errorMessage: string;
}>();
const emit = defineEmits<{ (e: 'retry'): void }>();

const scroller = ref<HTMLElement | null>(null);

watch(
  () => props.answer,
  async () => {
    await nextTick();
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' });
  },
);
</script>

<template>
  <div ref="scroller" class="answering">
    <div class="answering__card fade-up">
      <div class="answering__q-label"><IonIcon :icon="mic" /> Your question</div>
      <p class="answering__question">{{ question }}</p>
      <hr class="answering__divider" />

      <ErrorBox v-if="error" :message="errorMessage" @retry="emit('retry')" />
      <ThinkingIndicator v-else-if="!answer && !done" />
      <template v-else>
        <MarkdownContent :source="answer" />
        <div class="answering__status">
          <span v-if="done" key="done" class="answering__done fade-in">
            <IonIcon :icon="checkmarkCircleOutline" /> Answer complete
          </span>
          <span v-else key="answering" class="answering__working fade-in">
            <ThinkingDot /> AgakAI is answering…
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.answering {
  height: 100%;
  overflow-y: auto;
  padding: 16px 24px 24px;
  box-sizing: border-box;
}
.answering__card {
  padding: 23px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  box-shadow: 0 14px 14px rgba(0, 0, 0, 0.07);
}
.answering__q-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--c-navy);
}
.answering__q-label ion-icon {
  font-size: 20px;
}
.answering__question {
  margin: 12px 0 0;
  text-align: center;
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--c-slate-text);
}
.answering__divider {
  margin: 16px 0;
  border: none;
  border-top: 1px solid #e0e0e0;
}
.answering__status {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
.answering__done,
.answering__working {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.answering__done {
  font-size: 0.8125rem;
  color: var(--c-claim-green);
}
.answering__done ion-icon {
  font-size: 16px;
}
.answering__working {
  gap: 10px;
  font-size: 0.875rem;
  color: var(--c-mid-blue);
}
</style>
