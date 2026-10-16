<script setup lang="ts">
import ListeningPulse from '@/components/voice/ListeningPulse.vue';

/** Just the calm pulse; the instruction already lives in the mic dock. */
</script>

<template>
  <div class="listening-body"><ListeningPulse /></div>
</template>

<style scoped>
.listening-body {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 32px 40px;
  box-sizing: border-box;
}
</style>
