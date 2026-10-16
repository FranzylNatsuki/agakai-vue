<script setup lang="ts">
import { useSettings } from '@/composables/useSettings';

/**
 * Square-cornered confirmation dialog (title + content slot + Cancel/Confirm).
 * Not dismissable by tapping the backdrop (matches the Flutter dialog).
 */
defineProps<{ open: boolean; title: string; confirmText: string }>();
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'confirm'): void }>();

const { t } = useSettings();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="app-modal__backdrop">
        <div class="app-modal" role="dialog" aria-modal="true">
          <h2 class="app-modal__title">{{ title }}</h2>
          <div class="app-modal__content"><slot /></div>
          <div class="app-modal__actions">
            <button class="btn-reset app-modal__btn app-modal__btn--cancel tappable" @click="emit('cancel')">
              {{ t('cancel') }}
            </button>
            <button class="btn-reset app-modal__btn app-modal__btn--confirm tappable" @click="emit('confirm')">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 20000;
  background: rgba(0, 0, 0, 0.54);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}
.app-modal {
  width: 100%;
  max-width: 380px;
  max-height: 100%;
  overflow-y: auto;
  background: #fff;
  padding: 20px;
  box-sizing: border-box;
  font-family: var(--ion-font-family);
}
.app-modal__title {
  margin: 0 0 16px;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--c-forest-dark);
}
.app-modal__actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
.app-modal__btn {
  flex: 1;
  height: 46px;
  font-size: 0.875rem;
  font-weight: 700;
}
.app-modal__btn--cancel {
  border: 2px solid var(--c-slate-border);
  color: var(--c-slate-text);
  background: transparent;
}
.app-modal__btn--confirm {
  background: #093582;
  color: #fff;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
