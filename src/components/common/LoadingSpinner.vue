<script setup lang="ts">
defineProps<{ size?: number }>();
</script>

<template>
  <span class="spinner" :style="{ width: `${size ?? 28}px`, height: `${size ?? 28}px` }" />
</template>

<style scoped>
.spinner {
  display: inline-block;
  border-radius: 50%;
  border: 3px solid var(--c-pale-blue-bg);
  border-top-color: var(--c-navy);
  animation: spin 0.9s linear infinite;
  box-sizing: border-box;
}
</style>
