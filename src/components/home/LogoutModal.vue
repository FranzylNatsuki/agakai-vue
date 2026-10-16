<script setup lang="ts">
import AppModal from '@/components/common/AppModal.vue';
import { useSettings } from '@/composables/useSettings';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'confirm'): void }>();

const { t } = useSettings();
</script>

<template>
  <AppModal :open="open" :title="t('log_out')" :confirm-text="t('log_out')" @cancel="emit('cancel')" @confirm="emit('confirm')">
    <p class="logout-modal__text">{{ t('are_you_sure_logout') }}</p>
  </AppModal>
</template>

<style scoped>
.logout-modal__text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--c-forest-body);
}
</style>
