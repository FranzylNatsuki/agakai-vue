<script setup lang="ts">
import { ref } from 'vue';
import QuestionButton from '@/components/voice/QuestionButton.vue';
import AskBar from '@/components/voice/AskBar.vue';

const emit = defineEmits<{ (e: 'ask', question: string): void }>();

const suggestions = [
  { title: 'Social Pension', subtitle: 'unsaon pag dawat o i check an...' },
  { title: 'Mag-pa Check up', subtitle: 'libreang pa check up sa cit...' },
  { title: 'Senior Discount', subtitle: 'unsaon pag-gamit sa Senior C...' },
];

const text = ref('');

function submit(value: string) {
  const q = value.trim();
  if (!q) return;
  text.value = '';
  emit('ask', q);
}
</script>

<template>
  <div class="idle">
    <h2 class="idle__title">Try asking...</h2>
    <div class="idle__list">
      <QuestionButton
        v-for="q in suggestions"
        :key="q.title"
        :title="q.title"
        :subtitle="q.subtitle"
        @tap="submit(q.title)"
      />
    </div>
    <AskBar v-model="text" @submit="submit" />
  </div>
</template>

<style scoped>
.idle {
  height: 100%;
  overflow-y: auto;
  padding: 16px 24px 24px;
  box-sizing: border-box;
}
.idle__title {
  margin: 0 0 12px;
  font-size: 1.25rem;
  font-weight: 700;
}
.idle__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}
</style>
