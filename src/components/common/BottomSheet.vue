<script setup lang="ts">
/** Rounded-top bottom sheet (62% height) with a dimmed, dismissable backdrop. */
defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet__backdrop" @click.self="emit('close')">
        <div class="sheet" role="dialog" aria-modal="true">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet__backdrop {
  position: fixed;
  inset: 0;
  z-index: 20000;
  background: rgba(0, 0, 0, 0.54);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 430px;
  height: 62%;
  background: #fff;
  border-radius: 24px 24px 0 0;
  padding: 20px 24px calc(24px + var(--ion-safe-area-bottom, 0px));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  font-family: var(--ion-font-family);
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.3s cubic-bezier(0.215, 0.61, 0.355, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}
</style>
