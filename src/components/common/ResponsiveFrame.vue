<script setup lang="ts">
/**
 * Centers the mobile-first UI as a floating card on wide (desktop browser)
 * viewports. On phones / Capacitor it renders the content untouched.
 */
</script>

<template>
  <div class="responsive-frame">
    <div class="responsive-frame__inner">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.responsive-frame,
.responsive-frame__inner {
  position: relative;
  width: 100%;
  height: 100%;
}

@media (min-width: 700px) {
  .responsive-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--c-web-backdrop);
  }
  .responsive-frame__inner {
    width: 430px;
    height: calc(100% - 64px);
    border-radius: 28px;
    overflow: hidden;
    background: #fff;
    /* transform makes fixed-position children stay inside the frame */
    transform: translateZ(0);
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.06);
  }
}
</style>
