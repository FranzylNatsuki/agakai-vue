<script setup lang="ts">
/**
 * Centers the mobile-first UI inside the Tala `.phone` frame on wide desktop
 * viewports, and goes full-bleed on mobile screens (<= 480px).
 */
</script>

<template>
  <div class="stage">
    <div class="phone" id="phone">
      <div class="sb">
        <span>9:41</span>
        <span>●●● 100%</span>
      </div>
      <div class="phone__content">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  width: 100%;
  height: 100%;
  background: var(--stage);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
}

.phone {
  width: 392px;
  height: min(830px, 100%);
  background: var(--bg);
  border: 3px solid var(--ink);
  border-radius: 50px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  isolation: isolate;
  transform: translateZ(0);
}

.phone::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(480px 340px at 20% -8%, var(--g1), transparent 72%);
  pointer-events: none;
}

.sb {
  display: flex;
  justify-content: space-between;
  padding: 16px 30px 0;
  font-weight: 700;
  font-size: 15px;
  color: var(--ink);
  flex-shrink: 0;
  z-index: 2;
}

.phone__content {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}

@media (max-width: 480px) {
  .phone {
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 0;
  }
  .sb {
    display: none;
  }
}
</style>
