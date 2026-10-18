<script setup lang="ts">
import type { ChatContact } from '@/models/message';
import { formatMessageTime } from '@/models/message';

defineProps<{
  contacts: ChatContact[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', contact: ChatContact): void;
}>();
</script>

<template>
  <div class="chat-list">
    <div v-if="loading" class="chat-list__loading">
      <div class="chat-list__spinner" />
      <span>Loading conversations…</span>
    </div>

    <div v-else-if="contacts.length === 0" class="chat-list__empty">
      <div class="chat-list__empty-icon">
        <svg class="i"><use href="#users" /></svg>
      </div>
      <h4>No conversations yet</h4>
      <p>Connect with fellow seniors in your barangay or chat with the OSCA Helpdesk.</p>
    </div>

    <div v-else class="chat-list__items">
      <button
        v-for="contact in contacts"
        :key="contact.id"
        type="button"
        class="chat-item"
        @click="emit('select', contact)"
      >
        <div class="chat-item__avatar">
          {{ contact.initials || 'SC' }}
        </div>

        <div class="chat-item__content">
          <div class="chat-item__top">
            <span class="chat-item__name">{{ contact.name }}</span>
            <span v-if="contact.lastMessageTime" class="chat-item__time">
              {{ formatMessageTime(contact.lastMessageTime) }}
            </span>
          </div>

          <div class="chat-item__bottom">
            <span class="chat-item__preview">
              {{ contact.lastMessage || contact.subtitle || 'Tap to chat' }}
            </span>
            <svg class="i chat-item__chevron"><use href="#go" /></svg>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #ffffff;
  color: #000000;
}

.chat-list__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  gap: 12px;
  color: #4b5563;
  font-size: 15px;
}

.chat-list__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: #1b3a9e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.chat-list__empty {
  text-align: center;
  padding: 40px 20px;
  color: #4b5563;
}

.chat-list__empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background: rgba(27, 58, 158, 0.08);
  color: #1b3a9e;
  display: grid;
  place-items: center;
  margin: 0 auto 16px;
}

.chat-list__empty-icon .i {
  width: 28px;
  height: 28px;
}

.chat-list__empty h4 {
  font-size: calc(var(--fs, 20px) * 1.15);
  font-weight: 800;
  color: #000000;
  margin-bottom: 8px;
}

.chat-list__empty p {
  font-size: calc(var(--fs, 20px) * 0.85);
  line-height: 1.5;
  max-width: 300px;
  margin: 0 auto;
  color: #374151;
}

.chat-list__items {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 20px;
}

.chat-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border-radius: 18px;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  color: #000000;
  text-align: left;
  transition: background 0.15s ease, transform 0.1s ease;
  width: 100%;
}

.chat-item:active {
  transform: scale(0.99);
  background: #f8fafc;
}

.chat-item__avatar {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background: linear-gradient(135deg, #1b3a9e, #3b82f6);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.chat-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.chat-item__top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.chat-item__name {
  font-size: calc(var(--fs, 20px) * 1.05);
  font-weight: 800;
  color: #000000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item__time {
  font-size: calc(var(--fs, 20px) * 0.72);
  color: #4b5563;
  font-weight: 600;
  flex-shrink: 0;
}

.chat-item__bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.chat-item__preview {
  font-size: calc(var(--fs, 20px) * 0.85);
  line-height: 1.35;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item__chevron {
  width: 18px;
  height: 18px;
  color: #64748b;
  flex-shrink: 0;
}

</style>
