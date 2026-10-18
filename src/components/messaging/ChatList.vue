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
}

.chat-list__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  gap: 12px;
  color: var(--muted, #64748b);
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
  color: var(--muted, #64748b);
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
  font-size: 18px;
  font-weight: 700;
  color: var(--ink, #0f172a);
  margin-bottom: 6px;
}

.chat-list__empty p {
  font-size: 14px;
  line-height: 1.5;
  max-width: 280px;
  margin: 0 auto;
}

.chat-list__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--line, #e2e8f0);
  text-align: left;
  transition: background 0.15s ease, transform 0.1s ease;
  width: 100%;
}

.chat-item:active {
  transform: scale(0.99);
  background: rgba(0, 0, 0, 0.03);
}

.chat-item__avatar {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background: linear-gradient(135deg, #1b3a9e, #3b82f6);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.chat-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.chat-item__top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.chat-item__name {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item__time {
  font-size: 12px;
  color: var(--muted, #64748b);
  flex-shrink: 0;
}

.chat-item__bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.chat-item__preview {
  font-size: 14px;
  color: var(--muted, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item__chevron {
  width: 14px;
  height: 14px;
  color: var(--muted, #94a3b8);
  flex-shrink: 0;
}
</style>
