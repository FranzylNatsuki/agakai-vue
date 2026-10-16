<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import ResponsiveFrame from '@/components/common/ResponsiveFrame.vue';
</script>

<template>
  <ResponsiveFrame>
    <IonApp>
      <IonRouterOutlet />
    </IonApp>
  </ResponsiveFrame>
</template>
