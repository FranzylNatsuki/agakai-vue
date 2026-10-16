<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** Renders markdown (assistant answers / support notes) safely. */
const props = defineProps<{ source: string; variant?: 'answer' | 'notes' }>();

const html = computed(() =>
  DOMPurify.sanitize(marked.parse(props.source, { async: false, breaks: true }) as string),
);
</script>

<template>
  <div class="md" :class="`md--${variant ?? 'answer'}`" v-html="html" />
</template>

<style scoped>
.md {
  color: var(--c-slate-text);
  word-wrap: break-word;
}
.md :deep(p) {
  margin: 0 0 0.6em;
}
.md :deep(strong) {
  font-weight: 700;
  color: var(--c-ink);
}
.md :deep(h1),
.md :deep(h2),
.md :deep(h3) {
  margin: 0.6em 0 0.3em;
  font-weight: 700;
  color: var(--c-navy);
}
.md :deep(ul),
.md :deep(ol) {
  margin: 0 0 0.6em;
  padding-left: 1.4em;
}
.md :deep(blockquote) {
  margin: 0 0 0.6em;
  padding-left: 12px;
  border-left: 3px solid var(--c-slate-border);
  font-style: italic;
}

.md--answer {
  font-size: 1.125rem;
  line-height: 1.6;
}
.md--answer :deep(h1) { font-size: 1.25rem; }
.md--answer :deep(h2) { font-size: 1.1875rem; }
.md--answer :deep(h3) { font-size: 1.125rem; }
.md--answer :deep(blockquote) { font-size: 1.0625rem; }

.md--notes {
  font-size: 0.9375rem;
  line-height: 1.55;
}
.md--notes :deep(h1) { font-size: 1rem; }
.md--notes :deep(h2) { font-size: 0.9375rem; }
.md--notes :deep(h3) { font-size: 0.875rem; }
</style>
