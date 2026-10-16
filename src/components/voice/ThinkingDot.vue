<script setup lang="ts">
/** Pulsing dot (shown while waiting for / receiving the answer). */
</script>

<template>
  <span class="dot" />
</template>

<style scoped>
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c-bright-blue);
  animation: dot-pulse 0.9s ease-in-out infinite alternate;
}
@keyframes dot-pulse {
  from { opacity: 0.4; }
  to { opacity: 1; }
}
</style>
