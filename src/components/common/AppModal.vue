<script setup lang="ts">
import { useSettings } from '@/composables/useSettings';

/**
 * Rounded confirmation dialog (title + content slot + Cancel/Confirm).
 * Not dismissable by tapping the backdrop (matches the Flutter dialog).
 */
defineProps<{ open: boolean; title: string; confirmText: string; danger?: boolean; contentSize?: 'default' | 'large' }>();
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'confirm'): void }>();

const { t } = useSettings();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="app-modal__backdrop">
        <div class="app-modal" role="dialog" aria-modal="true">
          <h2 class="app-modal__title">{{ title }}</h2>
          <div class="app-modal__content" :class="{ 'app-modal__content--large': contentSize === 'large' }"><slot /></div>
          <div class="app-modal__actions">
            <button class="btn-reset app-modal__btn app-modal__btn--cancel tappable" @click="emit('cancel')">
              {{ t('cancel') }}
            </button>
            <button
              class="btn-reset app-modal__btn app-modal__btn--confirm tappable"
              :class="{ 'app-modal__btn--danger': danger }"
              @click="emit('confirm')"
            >
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  background: rgba(3, 4, 8, 0.6);
}
.app-modal {
  width: 100%;
  max-width: 380px;
  max-height: 100%;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 28px;
  background: var(--solid);
  padding: 20px;
  box-sizing: border-box;
  color: var(--ink);
  font-family: inherit;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
}
.app-modal__title {
  margin: 0 0 16px;
  font-size: calc(var(--fs) * 1.05);
  line-height: 1.2;
  font-weight: 800;
  color: var(--ink);
}
.app-modal__content {
  color: var(--muted);
  font-size: calc(var(--fs) * 0.85);
  line-height: 1.45;
}
.app-modal__content--large {
  font-size: var(--fs);
}
.app-modal__actions {
  position: sticky;
  bottom: -20px;
  z-index: 1;
  display: flex;
  gap: 10px;
  margin: 20px -20px -20px;
  padding: 12px 20px 20px;
  background: var(--solid);
}
.app-modal__btn {
  flex: 1;
  min-height: 56px;
  border-radius: 20px;
  font-size: calc(var(--fs) * 0.78);
  font-weight: 700;
}
.app-modal__btn--cancel {
  border: 1px solid var(--line);
  color: var(--brand-slate);
  background: var(--solid);
}
.app-modal__btn--confirm {
  background: var(--grad);
  color: #fff;
  box-shadow: 0 8px 22px var(--glow);
}
.app-modal__btn--confirm.app-modal__btn--danger {
  background: var(--danger);
  box-shadow: none;
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
