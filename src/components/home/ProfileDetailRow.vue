<script setup lang="ts">
defineProps<{ label: string; value: string; last?: boolean }>();
</script>

<template>
  <div class="detail-row" :class="{ 'detail-row--last': last }">
    <span class="detail-row__label">{{ label }}</span>
    <span class="detail-row__value">{{ value }}</span>
  </div>
</template>

<style scoped>
.detail-row {
  display: flex;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid var(--c-slate-100);
}
.detail-row--last {
  border-bottom: none;
}
.detail-row__label {
  width: 100px;
  flex-shrink: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--c-slate-500);
}
.detail-row__value {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--c-forest-dark);
}
</style>
