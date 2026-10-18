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
  display: grid;
  gap: 5px;
  padding: 14px 0;
  border-bottom: 1px solid var(--c-slate-border);
}
.detail-row--last {
  border-bottom: none;
}
.detail-row__label {
  font-size: 1rem;
  line-height: 1.35;
  font-weight: 600;
  color: var(--c-slate-text);
}
.detail-row__value {
  margin: 0;
  font-size: 1.2rem;
  line-height: 1.4;
  font-weight: 650;
  color: var(--c-ink);
  overflow-wrap: anywhere;
}
</style>
