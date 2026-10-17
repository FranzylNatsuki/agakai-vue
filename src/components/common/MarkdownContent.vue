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
  color: var(--ink);
  word-wrap: break-word;
}
.md :deep(p) {
  margin: 0 0 0.5em;
}
.md :deep(p:last-child) {
  margin-bottom: 0;
}
.md :deep(strong) {
  font-weight: 700;
  color: var(--ink);
}
.md :deep(h1),
.md :deep(h2),
.md :deep(h3) {
  margin: 0.5em 0 0.25em;
  font-weight: 700;
  color: var(--a2);
}
.md :deep(ul),
.md :deep(ol) {
  margin: 6px 0 0 22px;
  padding: 0;
}
.md :deep(blockquote) {
  margin: 0.4em 0 0;
  padding-left: 12px;
  border-left: 3px solid var(--a2);
  color: var(--muted);
  font-style: italic;
}

.md--answer {
  font-size: var(--fs);
  line-height: 1.4;
}

.md--notes {
  font-size: calc(var(--fs) * 0.85);
  line-height: 1.45;
  color: var(--muted);
}
</style>
