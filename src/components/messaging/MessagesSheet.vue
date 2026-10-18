<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { ChatContact } from '@/models/message';
import { messageService } from '@/services/messageService';
import ChatList from './ChatList.vue';
import ChatThread from './ChatThread.vue';

const props = defineProps<{
  currentUserId: number;
  initialContactId?: number | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const contacts = ref<ChatContact[]>([]);
const selectedContact = ref<ChatContact | null>(null);
const loading = ref(true);

async function loadContacts() {
  loading.value = true;
  try {
    contacts.value = await messageService.getContacts();
    if (props.initialContactId) {
      const match = contacts.value.find((c) => c.id === props.initialContactId);
      if (match) selectedContact.value = match;
    }
  } finally {
    loading.value = false;
  }
}

function handleSelectContact(contact: ChatContact) {
  selectedContact.value = contact;
}

function handleBackToList() {
  selectedContact.value = null;
  void loadContacts();
}

onMounted(() => {
  void loadContacts();
});

watch(
  () => props.initialContactId,
  (newId) => {
    if (newId) {
      const match = contacts.value.find((c) => c.id === newId);
      if (match) selectedContact.value = match;
    }
  },
);
</script>

<template>
  <div class="messages-sheet">
    <div v-if="!selectedContact" class="messages-sheet__header">
      <div class="messages-sheet__title-row">
        <div class="messages-sheet__title-wrap">
          <svg class="i messages-sheet__icon"><use href="#message" /></svg>
          <h3 class="messages-sheet__title">My messages</h3>
        </div>
        <button
          type="button"
          class="messages-sheet__close"
          aria-label="Close messages"
          @click="emit('close')"
        >
          <svg class="i"><use href="#x" /></svg>
        </button>
      </div>
      <p class="messages-sheet__subtitle">
        Talk with fellow seniors in your community and OSCA advisors.
      </p>
    </div>

    <!-- Contact List View -->
    <ChatList
      v-if="!selectedContact"
      :contacts="contacts"
      :loading="loading"
      @select="handleSelectContact"
    />

    <!-- Active Chat Thread View -->
    <ChatThread
      v-else
      :contact="selectedContact"
      :current-user-id="currentUserId"
      @back="handleBackToList"
    />
  </div>
</template>

<style scoped>
.messages-sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.messages-sheet__header {
  margin-bottom: 14px;
}

.messages-sheet__title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.messages-sheet__title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.messages-sheet__icon {
  width: 22px;
  height: 22px;
  color: #1b3a9e;
}

.messages-sheet__title {
  font-size: 20px;
  font-weight: 800;
  color: var(--ink, #0f172a);
  margin: 0;
}

.messages-sheet__close {
  width: 32px;
  height: 32px;
  border-radius: 16px;
  background: var(--glass, rgba(0, 0, 0, 0.05));
  display: grid;
  place-items: center;
  color: var(--ink, #0f172a);
}

.messages-sheet__close .i {
  width: 16px;
  height: 16px;
}

.messages-sheet__subtitle {
  font-size: 13px;
  color: var(--muted, #64748b);
  margin: 4px 0 0;
}
</style>
