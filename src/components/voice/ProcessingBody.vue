<script setup lang="ts">
import ListeningPulse from '@/components/voice/ListeningPulse.vue';
</script>

<template>
  <div class="center-body">
    <div class="center-body__inner">
      <ListeningPulse />
      <p class="center-body__title">Reading what you said…</p>
      <p class="center-body__sub">One moment, Lola/Lolo.</p>
    </div>
  </div>
</template>

<style scoped>
.center-body {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 32px 40px;
  box-sizing: border-box;
}
.center-body__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.center-body__title {
  margin: 20px 0 0;
  text-align: center;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--c-ink);
}
.center-body__sub {
  margin: 6px 0 0;
  text-align: center;
  font-size: 0.9375rem;
  color: var(--c-slate-text);
}
</style>
