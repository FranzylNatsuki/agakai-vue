<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import ResponsiveFrame from '@/components/common/ResponsiveFrame.vue';
import { markStartupSplashHidden } from '@/services/startupSplash';

const showStartupSplash = ref(true);
onMounted(() => {
  window.setTimeout(() => {
    showStartupSplash.value = false;
  }, 1000);
});
</script>

<template>
  <!-- Global SVG icon sprite from AgakAI -->
  <svg width="0" height="0" style="position: absolute; pointer-events: none" aria-hidden="true">
    <defs>
      <symbol id="kb" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="3" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
      </symbol>
      <symbol id="mic" viewBox="0 0 24 24">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </symbol>
      <symbol id="stop" viewBox="0 0 24 24">
        <rect x="5" y="5" width="14" height="14" rx="2" />
      </symbol>
      <symbol id="menu" viewBox="0 0 24 24">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </symbol>
      <symbol id="send" viewBox="0 0 24 24">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </symbol>
      <symbol id="x" viewBox="0 0 24 24">
        <path d="M6 6l12 12M18 6 6 18" />
      </symbol>
      <symbol id="award" viewBox="0 0 24 24">
        <circle cx="12" cy="9" r="6" />
        <path d="M8.5 14 7 22l5-3 5 3-1.5-8" />
      </symbol>
      <symbol id="users" viewBox="0 0 24 24">
        <circle cx="9.5" cy="8" r="3.5" />
        <path d="M3 20v-1a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v1M16 4.2a3.5 3.5 0 0 1 0 6.6M21 20v-1a4 4 0 0 0-3-3.9" />
      </symbol>
      <symbol id="user" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </symbol>
      <symbol id="pin" viewBox="0 0 24 24">
        <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </symbol>
      <symbol id="cross" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <path d="M12 8v8M8 12h8" />
      </symbol>
      <symbol id="sound" viewBox="0 0 24 24">
        <path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </symbol>
      <symbol id="go" viewBox="0 0 24 24">
        <path d="M9 6l6 6-6 6" />
      </symbol>
      <symbol id="phone" viewBox="0 0 24 24">
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
      </symbol>
      <symbol id="moon" viewBox="0 0 24 24">
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
      </symbol>
      <symbol id="heart" viewBox="0 0 24 24">
        <path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" />
      </symbol>
      <symbol id="check" viewBox="0 0 24 24">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </symbol>
      <symbol id="logout" viewBox="0 0 24 24">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </symbol>
    </defs>
  </svg>

  <ResponsiveFrame>
    <IonApp class="agakai-ion-app">
      <IonRouterOutlet />
    </IonApp>
    <Transition name="startup-splash" @after-leave="markStartupSplashHidden">
      <div v-if="showStartupSplash" class="startup-splash" role="img" aria-label="AgakAI — Agak, Kaabag, Kinaadman">
        <Transition name="startup-logo" appear>
          <img src="/assets/splash-logo-cropped.png" alt="AgakAI — Agak, Kaabag, Kinaadman" />
        </Transition>
      </div>
    </Transition>
  </ResponsiveFrame>
</template>

<style>
.startup-splash {
  position: absolute;
  inset: 0;
  z-index: 20000;
  display: grid;
  place-items: center;
  background: var(--bg);
}

.startup-splash img {
  display: block;
  width: min(86vw, 420px);
  max-height: 72%;
  object-fit: contain;
}

.startup-splash-leave-active {
  transition: opacity 360ms cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 360ms cubic-bezier(0.22, 0.61, 0.36, 1);
  transform-origin: center;
}

.startup-splash-leave-to {
  opacity: 0;
  transform: scale(0.985);
}

.startup-logo-appear-active {
  transition: opacity 420ms cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1);
  transform-origin: center;
}

.startup-logo-appear-from {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

.startup-logo-appear-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .startup-splash-leave-active,
  .startup-logo-appear-active {
    transition-duration: 1ms;
  }
}

.agakai-ion-app,
.agakai-ion-app ion-router-outlet,
.agakai-ion-app .ion-page {
  background: transparent !important;
}
</style>
