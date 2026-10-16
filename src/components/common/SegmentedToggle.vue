<script setup lang="ts" generic="T extends string | number | boolean">
/** Segmented toggle (Flutter ToggleButtons). */
defineProps<{
  options: { value: T; label: string }[];
  modelValue: T;
  /** Corner radius in px; 0 = square. */
  radius?: number;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: T): void }>();
</script>

<template>
  <div class="seg" :style="{ borderRadius: `${radius ?? 0}px` }">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      class="btn-reset seg__btn"
      :class="{ 'seg__btn--active': opt.value === modelValue }"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.seg {
  display: inline-flex;
  height: 32px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.28);
  flex-shrink: 0;
}
.seg__btn {
  padding: 0 10px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--c-forest-dark);
  background: transparent;
  white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease;
}
.seg__btn + .seg__btn {
  border-left: 1px solid rgba(0, 0, 0, 0.28);
}
.seg__btn--active {
  background: #093582;
  color: #fff;
}
</style>
