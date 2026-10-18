<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { bulbOutline } from 'ionicons/icons';
import BottomSheet from '@/components/common/BottomSheet.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import MarkdownContent from '@/components/common/MarkdownContent.vue';
import { profileService } from '@/services/profileService';
import { useSettings } from '@/composables/useSettings';

/** "?" sheet: the senior's rolling support notes (`user_notes`). */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const loading = ref(false);
const notes = ref<string | null>(null);
const summary = ref('');
const { t } = useSettings();

// Memory changes after every exchange, so refetch each time the sheet opens.
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    loading.value = true;
    const memory = await profileService.loadMemory();
    summary.value = memory.summary;
    notes.value = memory.notes;
    loading.value = false;
  },
);
</script>

<template>
  <BottomSheet :open="open" @close="emit('close')">
    <div class="notes__head">
      <div class="notes__heading">
        <IonIcon class="notes__icon" :icon="bulbOutline" />
        <h2 class="notes__title">Support notes</h2>
      </div>
      <button class="notes__close" type="button" :aria-label="t('close_notes')" @click="emit('close')">
        <span aria-hidden="true">×</span>
        {{ t('close_notes') }}
      </button>
    </div>
    <p class="notes__sub">Your questions, interests, and concerns.</p>

    <p v-if="summary" class="notes__summary">{{ summary }}</p>

    <div class="notes__body">
      <div v-if="loading" class="notes__center"><LoadingSpinner /></div>
      <p v-else-if="notes === null" class="notes__center notes__muted">Could not load notes.</p>
      <p v-else-if="!notes.trim()" class="notes__center notes__muted">No notes yet — start a conversation.</p>
      <MarkdownContent v-else :source="notes" variant="notes" />
    </div>
  </BottomSheet>
</template>

<style scoped>
.notes__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.notes__heading {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.notes__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 48px;
  padding: 6px 10px;
  border: 1px solid var(--c-slate-border);
  border-radius: 14px;
  background: var(--c-pale-blue-bg);
  color: var(--c-navy);
  font-size: calc(var(--fs) * 0.7);
  line-height: 1.2;
  font-weight: 700;
  white-space: nowrap;
}
.notes__close span {
  font-size: 1.3em;
  line-height: 1;
}
.notes__icon {
  font-size: 24px;
  color: var(--c-navy);
}
.notes__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--c-ink);
}
.notes__sub {
  margin: 6px 0 16px;
  font-size: 0.8125rem;
  color: var(--c-slate-text);
}
.notes__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.notes__summary {
  margin: 0 0 14px;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--c-ink);
}
.notes__center {
  display: flex;
  justify-content: center;
  margin: 24px 0;
}
.notes__muted {
  color: var(--c-slate-text);
}
</style>
