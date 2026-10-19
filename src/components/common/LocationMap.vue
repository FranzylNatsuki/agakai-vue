<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import 'leaflet/dist/leaflet.css';
import type { MapLocation } from '@/models/mapLocation';
import { useSettings } from '@/composables/useSettings';
import { getCurrentLocation } from '@/services/location';

const props = withDefaults(defineProps<{ location: MapLocation; compact?: boolean }>(), {
  compact: false,
});
const { t } = useSettings();
const mapElement = ref<HTMLDivElement | null>(null);
const status = ref<'loading' | 'ready' | 'error'>('loading');
const hasUserLocation = ref(false);
let map: any = null;
let userMarker: any = null;

function brandColor(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

function addDestinationMarker(leaflet: any, point: [number, number]) {
  const coral = brandColor('--brand-coral');
  const slate = brandColor('--brand-slate');
  const icon = leaflet.divIcon({
    className: 'agakai-destination-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44" aria-hidden="true"><path d="M18 2.5C9.5 2.5 3 9 3 17c0 10 15 24 15 24s15-14 15-24c0-8-6.5-14.5-15-14.5Z" fill="${coral}" stroke="${slate}" stroke-width="2.5"/><circle cx="18" cy="17" r="5" fill="#fff" stroke="${slate}" stroke-width="1.5"/></svg>`,
    iconSize: [36, 44],
    iconAnchor: [18, 41],
    tooltipAnchor: [0, -40],
  });
  return leaflet.marker(point, { icon }).bindTooltip(props.location.name, {
    permanent: true,
    direction: 'top',
    offset: [0, -4],
  }).addTo(map);
}

async function locate() {
  status.value = 'loading';
  hasUserLocation.value = false;
  userMarker?.remove();
  userMarker = null;
  try {
    const position = await getCurrentLocation();
    if (!map) return;
    const point: [number, number] = [position.latitude, position.longitude];
    const leaflet = await import('leaflet');
    userMarker?.remove();
    userMarker = leaflet.circleMarker(point, {
      radius: 10,
      color: brandColor('--solid'),
      weight: 4,
      fillColor: brandColor('--brand-blue'),
      fillOpacity: 1,
    }).bindTooltip(t('map_you_are_here'), { permanent: true, direction: 'top', offset: [0, -12] }).addTo(map);
    const place: [number, number] = [props.location.latitude, props.location.longitude];
    map.fitBounds([place, point], { padding: [36, 36], maxZoom: 15 });
    hasUserLocation.value = true;
    status.value = 'ready';
  } catch {
    status.value = 'error';
  }
}

onMounted(async () => {
  if (!mapElement.value) return;
  const leaflet = await import('leaflet');
  const point: [number, number] = [props.location.latitude, props.location.longitude];
  map = leaflet.map(mapElement.value, {
    zoomControl: !props.compact,
    dragging: !props.compact,
    scrollWheelZoom: !props.compact,
    doubleClickZoom: !props.compact,
    touchZoom: !props.compact,
    keyboard: !props.compact,
  }).setView(point, 14);
  leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  addDestinationMarker(leaflet, point);

  if (props.compact) {
    status.value = 'ready';
    return;
  }
  await locate();
});

onBeforeUnmount(() => {
  map?.remove();
  map = null;
  userMarker = null;
});
</script>

<template>
  <section class="location-map" :aria-label="location.name">
    <div ref="mapElement" class="location-map__canvas" :class="{ 'location-map__canvas--compact': compact }" />
    <template v-if="!compact">
      <div class="location-map__legend" role="group" :aria-label="t('map_legend')">
        <div v-if="hasUserLocation" class="location-map__legend-item">
          <span class="location-map__dot location-map__dot--you" aria-hidden="true" />
          {{ t('map_you_are_here') }}
        </div>
        <div class="location-map__legend-item">
          <span class="location-map__dot location-map__dot--destination" aria-hidden="true" />
          {{ t('map_destination') }}: {{ location.name }}
        </div>
      </div>
      <p class="location-map__status" role="status">
        {{ t(status === 'loading' ? 'map_locating' : status === 'ready' ? 'map_location_ready' : 'map_location_failed') }}
      </p>
      <button v-if="status === 'error'" class="location-map__retry" type="button" @click="locate">
        {{ t('map_retry') }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.location-map {
  position: relative;
  z-index: 0;
  isolation: isolate;
  display: grid;
  gap: 8px;
}
.location-map__canvas {
  width: 100%;
  height: min(42vh, 320px);
  min-height: 220px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #e8eef1;
}
.location-map__canvas--compact {
  height: 150px;
  min-height: 150px;
  border: 0;
  border-radius: 0;
}
.location-map__legend { display: flex; flex-wrap: wrap; gap: 8px 18px; }
.location-map__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink);
  font-size: 0.94rem;
  font-weight: 650;
  line-height: 1.35;
}
.location-map__dot {
  width: 14px;
  height: 14px;
  flex: none;
  border: 2px solid var(--solid);
  border-radius: 50%;
}
.location-map__dot--you { background: var(--brand-blue); }
.location-map__dot--destination {
  width: 13px;
  height: 13px;
  border: 2px solid var(--brand-slate);
  border-radius: 50% 50% 50% 0;
  background: var(--brand-coral);
  transform: rotate(-45deg);
}
.location-map__status {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.4;
}
.location-map__retry {
  min-height: 48px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--solid);
  color: var(--ink);
  font: inherit;
  font-weight: 700;
}
</style>
