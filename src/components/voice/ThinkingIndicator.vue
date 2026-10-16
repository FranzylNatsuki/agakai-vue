<script setup lang="ts">
import ThinkingDot from '@/components/voice/ThinkingDot.vue';

/** Shown while waiting for the first LLM token. */
</script>

<template>
  <div class="thinking">
    <ThinkingDot />
    <span>AgakAI is thinking…</span>
  </div>
</template>

<style scoped>
.thinking {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--c-mid-blue);
}
</style>
