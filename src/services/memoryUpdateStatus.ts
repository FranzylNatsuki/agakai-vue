import { computed, ref } from 'vue';

const activeUpdates = ref(0);

export const memoryUpdateStatus = {
  isUpdating: computed(() => activeUpdates.value > 0),
  begin() {
    activeUpdates.value += 1;
  },
  end() {
    activeUpdates.value = Math.max(0, activeUpdates.value - 1);
  },
};
