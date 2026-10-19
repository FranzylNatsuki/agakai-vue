<script setup lang="ts">
import ListeningPulse from '@/components/voice/ListeningPulse.vue';

defineProps<{ transcript?: string }>();

/** Shows live Scribe text beneath the pulse while the senior is speaking. */
</script>

<template>
  <div class="listening-body">
    <ListeningPulse />
    <p v-if="transcript" class="listening-body__transcript">{{ transcript }}</p>
  </div>
</template>

<style scoped>
.listening-body {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 0 32px 40px;
  box-sizing: border-box;
}
.listening-body__transcript {
  max-width: 100%;
  max-height: 8.4em;
  overflow-y: auto;
  margin: 0;
  color: var(--c-ink);
  font-size: 1.125rem;
  line-height: 1.4;
  text-align: center;
  overflow-wrap: anywhere;
}
</style>
