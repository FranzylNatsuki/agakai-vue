<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ChatContact, Message } from '@/models/message';
import { formatMessageTime } from '@/models/message';
import { messageService } from '@/services/messageService';
import { voiceRecorder } from '@/services/voiceRecorder';
import { transcribeAudio } from '@/services/agakaiApi';
import { ttsPlayer } from '@/services/ttsPlayer';
import { useSettings } from '@/composables/useSettings';

const props = defineProps<{
  contact: ChatContact;
  currentUserId: number;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
}>();

const { language } = useSettings();

const messages = ref<Message[]>([]);
const loading = ref(true);
const draftText = ref('');
const sending = ref(false);
const recording = ref(false);
const transcribing = ref(false);
const scrollContainer = ref<HTMLElement | null>(null);

let unsubscribeRealtime: (() => void) | null = null;

async function scrollToBottom() {
  await nextTick();
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
}

async function loadMessages() {
  loading.value = true;
  try {
    messages.value = await messageService.getMessages(props.contact.id);
    await scrollToBottom();
  } finally {
    loading.value = false;
  }
}

function handleIncomingMessage(msg: Message) {
  if (!messages.value.some((m) => m.id === msg.id)) {
    messages.value.push(msg);
    void scrollToBottom();
  }
}

async function sendMessage() {
  const text = draftText.value.trim();
  if (!text || sending.value) return;

  sending.value = true;
  draftText.value = '';
  try {
    const sent = await messageService.sendMessage(props.contact.id, text);
    if (!messages.value.some((m) => m.id === sent.id)) {
      messages.value.push(sent);
    }
    await scrollToBottom();
  } catch {
    draftText.value = text;
  } finally {
    sending.value = false;
  }
}

function playTts(text: string) {
  void ttsPlayer.play(null, text, language.value);
}

// Voice dictation using voiceRecorder + ElevenLabs STT
async function toggleRecording() {
  if (recording.value) {
    recording.value = false;
    transcribing.value = true;
    try {
      const format = voiceRecorder.getFormat();
      const mime = voiceRecorder.getMimeType();
      const bytes = await voiceRecorder.stop();
      if (bytes && bytes.byteLength > 0) {
        const transcript = await transcribeAudio(bytes, language.value, format, mime);
        if (transcript) {
          draftText.value = draftText.value ? `${draftText.value} ${transcript}` : transcript;
        }
      }
    } catch {
      // Ignore dictation error
    } finally {
      transcribing.value = false;
    }
  } else {
    const ok = await voiceRecorder.start();
    if (ok) {
      recording.value = true;
    }
  }
}

onMounted(() => {
  void loadMessages();
  unsubscribeRealtime = messageService.subscribeToMessages(
    props.contact.id,
    handleIncomingMessage,
  );
});

onBeforeUnmount(() => {
  unsubscribeRealtime?.();
  if (recording.value) {
    void voiceRecorder.cancel();
  }
});

watch(
  () => props.contact.id,
  () => {
    unsubscribeRealtime?.();
    void loadMessages();
    unsubscribeRealtime = messageService.subscribeToMessages(
      props.contact.id,
      handleIncomingMessage,
    );
  },
);
</script>

<template>
  <div class="chat-thread">
    <!-- Thread Header -->
    <header class="thread-header">
      <button
        type="button"
        class="thread-header__back"
        aria-label="Back to contacts"
        @click="emit('back')"
      >
        <svg class="i"><use href="#arrow-left" /></svg>
      </button>

      <div class="thread-header__avatar">
        {{ contact.initials || 'SC' }}
      </div>

      <div class="thread-header__info">
        <h4 class="thread-header__name">{{ contact.name }}</h4>
        <span class="thread-header__sub">{{ contact.subtitle || contact.city || 'Online' }}</span>
      </div>
    </header>

    <!-- Messages Container -->
    <div ref="scrollContainer" class="thread-messages">
      <div v-if="loading" class="thread-messages__loading">
        <div class="thread-spinner" />
        <span>Loading messages…</span>
      </div>

      <div v-else-if="messages.length === 0" class="thread-messages__empty">
        <p>No messages yet. Say hello to {{ contact.name }}!</p>
      </div>

      <template v-else>
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="msg-bubble-wrap"
          :class="{ 'msg-bubble-wrap--me': msg.sender_id === currentUserId }"
        >
          <div
            class="msg-bubble"
            :class="{ 'msg-bubble--me': msg.sender_id === currentUserId }"
          >
            <p class="msg-bubble__text">{{ msg.message }}</p>

            <div class="msg-bubble__footer">
              <span class="msg-bubble__time">{{ formatMessageTime(msg.created_at) }}</span>

              <!-- Read message aloud (TTS) for received messages -->
              <button
                v-if="msg.sender_id !== currentUserId"
                type="button"
                class="msg-bubble__tts"
                title="Hear message aloud"
                @click="playTts(msg.message)"
              >
                <svg class="i"><use href="#sound" /></svg>
                <span>Hear</span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Voice Recording Banner -->
    <div v-if="recording || transcribing" class="voice-banner">
      <div class="voice-banner__indicator" :class="{ 'voice-banner__indicator--pulse': recording }" />
      <span>{{ recording ? 'Listening… speak your message' : 'Transcribing voice…' }}</span>
      <button v-if="recording" type="button" class="voice-banner__done" @click="toggleRecording">
        Done
      </button>
    </div>

    <!-- Input Composer -->
    <form class="thread-composer" @submit.prevent="sendMessage">
      <button
        type="button"
        class="composer-btn composer-btn--mic"
        :class="{ 'composer-btn--active': recording }"
        title="Dictate with voice"
        @click="toggleRecording"
      >
        <svg class="i"><use href="#mic" /></svg>
      </button>

      <input
        v-model="draftText"
        type="text"
        class="composer-input"
        placeholder="Type a message…"
        aria-label="Type a message"
        :disabled="sending || transcribing"
      />

      <button
        type="submit"
        class="composer-btn composer-btn--send"
        :disabled="!draftText.trim() || sending"
        aria-label="Send message"
      >
        <svg class="i"><use href="#send" /></svg>
      </button>
    </form>
  </div>
</template>

<style scoped>
.chat-thread {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  min-height: 0;
  position: relative;
  background: #ffffff;
  color: #000000;
}

.thread-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px 12px;
  border-bottom: 1.5px solid #e2e8f0;
  background: #ffffff;
  color: #000000;
  flex-shrink: 0;
}

.thread-header__back {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background: #f1f5f9;
  display: grid;
  place-items: center;
  color: #000000;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.thread-header__back:active {
  background: #e2e8f0;
}

.thread-header__back .i {
  width: 24px;
  height: 24px;
}

.thread-header__avatar {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background: linear-gradient(135deg, #1b3a9e, #3b82f6);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: calc(var(--fs, 20px) * 0.9);
  flex-shrink: 0;
}

.thread-header__info {
  flex: 1;
  min-width: 0;
}

.thread-header__name {
  font-size: calc(var(--fs, 20px) * 1.15);
  font-weight: 800;
  color: #000000;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thread-header__sub {
  font-size: calc(var(--fs, 20px) * 0.75);
  font-weight: 600;
  color: #4b5563;
  display: block;
}

.thread-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 4px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: #ffffff;
}

.thread-messages__loading,
.thread-messages__empty {
  text-align: center;
  color: #4b5563;
  padding: 40px 16px;
  font-size: calc(var(--fs, 20px) * 0.85);
  line-height: 1.5;
}

.thread-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: #1b3a9e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.msg-bubble-wrap {
  display: flex;
  justify-content: flex-start;
  width: 100%;
}

.msg-bubble-wrap--me {
  justify-content: flex-end;
}

.msg-bubble {
  max-width: 85%;
  padding: 14px 18px;
  border-radius: 20px;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  color: #000000;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.msg-bubble--me {
  background: #1b3a9e;
  border-color: #1b3a9e;
  color: #ffffff;
  border-bottom-right-radius: 4px;
}

.msg-bubble-wrap:not(.msg-bubble-wrap--me) .msg-bubble {
  border-bottom-left-radius: 4px;
}

.msg-bubble__text {
  font-size: calc(var(--fs, 20px) * 1.05);
  line-height: 1.5;
  margin: 0;
  word-break: break-word;
  color: #000000;
}

.msg-bubble--me .msg-bubble__text {
  color: #ffffff;
}

.msg-bubble__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.msg-bubble__time {
  font-size: calc(var(--fs, 20px) * 0.72);
  color: #4b5563;
  font-weight: 600;
}

.msg-bubble--me .msg-bubble__time {
  color: rgba(255, 255, 255, 0.85);
}

.msg-bubble__tts {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 16px;
  background: #eff6ff;
  color: #1b3a9e;
  font-size: calc(var(--fs, 20px) * 0.75);
  font-weight: 700;
  border: 1.5px solid #bfdbfe;
  cursor: pointer;
  min-height: 32px;
}

.msg-bubble__tts .i {
  width: 16px;
  height: 16px;
}

.voice-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #eff6ff;
  border: 1.5px solid #bfdbfe;
  border-radius: 14px;
  font-size: calc(var(--fs, 20px) * 0.85);
  font-weight: 700;
  color: #1b3a9e;
  margin-bottom: 8px;
}

.voice-banner__indicator {
  width: 14px;
  height: 14px;
  border-radius: 7px;
  background: #ef4444;
}

.voice-banner__indicator--pulse {
  animation: pulse 1s ease-in-out infinite alternate;
}

@keyframes pulse {
  from {
    transform: scale(0.9);
    opacity: 0.6;
  }
  to {
    transform: scale(1.3);
    opacity: 1;
  }
}

.voice-banner__done {
  margin-left: auto;
  padding: 8px 16px;
  border-radius: 12px;
  background: #1b3a9e;
  color: #ffffff;
  font-size: calc(var(--fs, 20px) * 0.8);
  font-weight: 700;
}

.thread-composer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0 6px;
  border-top: 1.5px solid #e2e8f0;
  background: #ffffff;
  flex-shrink: 0;
}

.composer-input {
  flex: 1;
  height: 56px;
  padding: 0 18px;
  border-radius: 28px;
  border: 1.5px solid #cbd5e1;
  background: #ffffff;
  color: #000000;
  font-size: calc(var(--fs, 20px) * 0.95);
  outline: none;
}

.composer-input::placeholder {
  color: #6b7280;
}

.composer-input:focus {
  border-color: #1b3a9e;
  box-shadow: 0 0 0 2px rgba(27, 58, 158, 0.15);
}

.composer-btn {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: transform 0.1s ease;
}

.composer-btn:active {
  transform: scale(0.95);
}

.composer-btn--mic {
  background: #f1f5f9;
  color: #000000;
  border: 1.5px solid #cbd5e1;
}

.composer-btn--mic.composer-btn--active {
  background: #ef4444;
  color: #ffffff;
  border-color: #ef4444;
}

.composer-btn--send {
  background: #1b3a9e;
  color: #ffffff;
}

.composer-btn--send:disabled {
  opacity: 0.35;
}

.composer-btn .i {
  width: 26px;
  height: 26px;
}
</style>
