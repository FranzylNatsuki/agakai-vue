<script setup lang="ts">
/** Calm pulsing circle + soft ring while the mic is live / processing. */
</script>

<template>
  <div class="pulse">
    <span class="pulse__core" />
    <span class="pulse__ring" />
  </div>
</template>

<style scoped>
.pulse {
  position: relative;
  width: 78px;
  height: 78px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pulse__core {
  position: absolute;
  border-radius: 50%;
  background: var(--c-pale-blue-bg);
  animation: pulse-core 1.1s ease-in-out infinite alternate;
}
.pulse__ring {
  position: absolute;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: var(--c-sky-blue-bg-2);
  opacity: 0.45;
}
@keyframes pulse-core {
  from { width: 78px; height: 78px; }
  to { width: 56px; height: 56px; }
}
</style>
