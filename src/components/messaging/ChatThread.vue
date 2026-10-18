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
  // Prevent duplicate if already added
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
  } catch (err) {
    // Restore text if failed
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
    // Stop and transcribe
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
    // Start recording
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
  max-height: 75vh;
  position: relative;
}

.thread-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 4px 12px;
  border-bottom: 1px solid var(--line, #e2e8f0);
  flex-shrink: 0;
}

.thread-header__back {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: var(--glass, rgba(0, 0, 0, 0.04));
  display: grid;
  place-items: center;
  color: var(--ink, #0f172a);
}

.thread-header__back .i {
  width: 20px;
  height: 20px;
}

.thread-header__avatar {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: linear-gradient(135deg, #1b3a9e, #3b82f6);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
}

.thread-header__info {
  flex: 1;
  min-width: 0;
}

.thread-header__name {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink, #0f172a);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thread-header__sub {
  font-size: 12px;
  color: var(--muted, #64748b);
  display: block;
}

.thread-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 4px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 220px;
}

.thread-messages__loading,
.thread-messages__empty {
  text-align: center;
  color: var(--muted, #64748b);
  padding: 40px 16px;
  font-size: 14px;
}

.thread-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: #1b3a9e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 10px;
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
  max-width: 82%;
  padding: 10px 14px;
  border-radius: 18px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--line, #e2e8f0);
  color: var(--ink, #0f172a);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
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
  font-size: 15px;
  line-height: 1.45;
  margin: 0;
  word-break: break-word;
}

.msg-bubble__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

.msg-bubble__time {
  font-size: 11px;
  opacity: 0.75;
}

.msg-bubble__tts {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(27, 58, 158, 0.08);
  color: #1b3a9e;
  font-size: 11px;
  font-weight: 600;
  border: none;
}

.msg-bubble__tts .i {
  width: 12px;
  height: 12px;
}

.voice-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(27, 58, 158, 0.1);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #1b3a9e;
  margin-bottom: 8px;
}

.voice-banner__indicator {
  width: 10px;
  height: 10px;
  border-radius: 5px;
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
  padding: 4px 10px;
  border-radius: 8px;
  background: #1b3a9e;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.thread-composer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--line, #e2e8f0);
  flex-shrink: 0;
}

.composer-input {
  flex: 1;
  height: 44px;
  padding: 0 14px;
  border-radius: 22px;
  border: 1px solid var(--line, #e2e8f0);
  background: var(--card-bg, #ffffff);
  color: var(--ink, #0f172a);
  font-size: 15px;
  outline: none;
}

.composer-input:focus {
  border-color: #1b3a9e;
}

.composer-btn {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: transform 0.1s ease;
}

.composer-btn:active {
  transform: scale(0.95);
}

.composer-btn--mic {
  background: var(--glass, rgba(0, 0, 0, 0.05));
  color: var(--ink, #0f172a);
}

.composer-btn--mic.composer-btn--active {
  background: #ef4444;
  color: #ffffff;
}

.composer-btn--send {
  background: #1b3a9e;
  color: #ffffff;
}

.composer-btn--send:disabled {
  opacity: 0.4;
}

.composer-btn .i {
  width: 20px;
  height: 20px;
}
</style>
