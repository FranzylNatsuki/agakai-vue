<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { bulbOutline } from 'ionicons/icons';
import BottomSheet from '@/components/common/BottomSheet.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import MarkdownContent from '@/components/common/MarkdownContent.vue';
import { profileService } from '@/services/profileService';

/** "?" sheet: the senior's rolling support notes (`user_notes`). */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const loading = ref(false);
const notes = ref<string | null>(null);

// Notes change after every exchange, so refetch each time the sheet opens.
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    loading.value = true;
    notes.value = await profileService.loadUserNotes();
    loading.value = false;
  },
);
</script>

<template>
  <BottomSheet :open="open" @close="emit('close')">
    <div class="notes__head">
      <IonIcon class="notes__icon" :icon="bulbOutline" />
      <h2 class="notes__title">Support notes</h2>
    </div>
    <p class="notes__sub">How AgakAI is getting to know Lola/Lolo — updated after each conversation.</p>

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
  gap: 10px;
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
.notes__center {
  display: flex;
  justify-content: center;
  margin: 24px 0;
}
.notes__muted {
  color: var(--c-slate-text);
}
</style>
