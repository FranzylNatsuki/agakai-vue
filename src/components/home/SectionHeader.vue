<script setup lang="ts">
defineProps<{ title: string; viewAllLabel: string }>();
const emit = defineEmits<{ (e: 'viewAll'): void }>();
</script>

<template>
  <div class="section-header">
    <h2 class="section-header__title">{{ title }}</h2>
    <button class="btn-reset section-header__link tappable" @click="emit('viewAll')">
      {{ viewAllLabel }}
    </button>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.section-header__title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 1.1875rem;
  font-weight: 600;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.section-header__link {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--c-dashboard-accent);
}
</style>
