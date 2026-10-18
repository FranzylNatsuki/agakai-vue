<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { IonToast } from '@ionic/vue';
import { helpCircleOutline } from 'ionicons/icons';
import ScreenHeader from '@/components/common/ScreenHeader.vue';
import CircleButton from '@/components/common/CircleButton.vue';
import MicDock from '@/components/voice/MicDock.vue';
import IdleBody from '@/components/voice/IdleBody.vue';
import ListeningBody from '@/components/voice/ListeningBody.vue';
import ProcessingBody from '@/components/voice/ProcessingBody.vue';
import AnsweringBody from '@/components/voice/AnsweringBody.vue';
import NotesSheet from '@/components/voice/NotesSheet.vue';
import { agakApi } from '@/services/agakaiApi';
import { voiceRecorder } from '@/services/voiceRecorder';
import { ttsPlayer } from '@/services/ttsPlayer';
import { profileService } from '@/services/profileService';
import { useSettings } from '@/composables/useSettings';

type VoiceState = 'idle' | 'listening' | 'processing' | 'answering';

const emit = defineEmits<{ (e: 'back'): void }>();
const { language } = useSettings();

const state = ref<VoiceState>('idle');
const question = ref('');
const answer = ref('');
const chatDone = ref(false);
const chatError = ref(false);
const chatErrorMessage = ref('');
const soundLevel = ref(0);
const notesOpen = ref(false);
const toast = ref({ open: false, message: '' });

/** Bumped on every new ask/reset so stale in-flight streams are discarded. */
let chatGen = 0;
let unsubscribeAmp: (() => void) | null = null;
let audioChunks: Uint8Array[] = [];

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

const dockLabel = computed(
  () =>
    ({
      idle: 'Tap to Speak',
      listening: "Listening… tap the mic when you're done",
      processing: 'Reading what you said…',
      answering: 'Tap to Ask Again',
    })[state.value],
);

function showToast(message: string) {
  toast.value = { open: true, message };
}

// ---- microphone ---------------------------------------------------------

async function startListening() {
  await ttsPlayer.stop();
  const ok = await voiceRecorder.start();
  if (!ok) {
    showToast("Voice isn't available on this device right now. You can still type your question below.");
    return;
  }
  unsubscribeAmp?.();
  unsubscribeAmp = voiceRecorder.onAmplitude((db) => {
    if (state.value === 'listening') soundLevel.value = db;
  });
  soundLevel.value = 0;
  state.value = 'listening';
}

async function stopListening() {
  if (state.value !== 'listening') return;
  unsubscribeAmp?.();
  unsubscribeAmp = null;
  state.value = 'processing';
  const bytes = await voiceRecorder.stop();
  if (!bytes || bytes.length === 0) {
    state.value = 'idle';
    showToast("I didn't catch that. Please try again.");
    return;
  }
  audioChunks = [];
  await runChat({
    audioBytes: bytes,
    audioFormat: voiceRecorder.getFormat(),
    audioMimeType: voiceRecorder.getMimeType(),
  });
}

// ---- chat ---------------------------------------------------------------

function ask(q: string) {
  const text = q.trim();
  if (!text) return;
  void ttsPlayer.stop();
  audioChunks = [];
  state.value = 'answering';
  question.value = text;
  answer.value = '';
  chatDone.value = false;
  chatError.value = false;
  chatErrorMessage.value = '';
  void runChat({ text });
}

async function runChat(req: {
  text?: string;
  audioBytes?: Uint8Array;
  audioFormat?: string;
  audioMimeType?: string;
}) {
  const gen = ++chatGen;
  const profile = await profileService.loadProfileOrNull();
  const user = profile
    ? { id: profile.id, name: profile.name, age: profile.age, gender: profile.gender, address: profile.address }
    : null;
  if (gen !== chatGen) return;

  try {
    for await (const event of agakApi.chatStream({ ...req, user })) {
      if (gen !== chatGen) return; // superseded by a newer ask
      switch (event.type) {
        case 'transcript':
          state.value = 'answering';
          question.value = event.question;
          break;
        case 'delta':
          if (state.value !== 'answering') state.value = 'answering';
          answer.value += event.text;
          break;
        case 'audio':
          audioChunks.push(event.chunk);
          break;
        case 'done': {
          answer.value = event.answer;
          chatDone.value = true;
          const combinedAudio = concatUint8Arrays(audioChunks);
          await ttsPlayer.play(combinedAudio, event.answer, language.value);
          break;
        }
        case 'error':
          state.value = 'answering';
          chatError.value = true;
          chatErrorMessage.value = event.message;
          await ttsPlayer.stop();
          break;
      }
    }
  } catch (e) {
    if (gen !== chatGen) return;
    await ttsPlayer.stop();
    state.value = 'answering';
    chatError.value = true;
    chatErrorMessage.value = `Network error: ${(e as Error).message}`;
  }
}

async function reset() {
  chatGen++; // discard any in-flight stream
  await voiceRecorder.cancel();
  unsubscribeAmp?.();
  unsubscribeAmp = null;
  await ttsPlayer.stop();
  audioChunks = [];
  soundLevel.value = 0;
  state.value = 'idle';
  question.value = '';
  answer.value = '';
  chatDone.value = false;
  chatError.value = false;
}

function onMicTap() {
  if (state.value === 'idle') void startListening();
  else if (state.value === 'listening') void stopListening();
  else if (state.value === 'answering') void reset();
  // processing: no-op
}

onBeforeUnmount(() => {
  chatGen++;
  unsubscribeAmp?.();
  void voiceRecorder.cancel();
  void ttsPlayer.stop();
});
</script>

<template>
  <div class="voice">
    <ScreenHeader title="Ask Anything" subtitle="Ako ang imong OSCA assistant" @back="emit('back')">
      <template #trailing>
        <CircleButton :icon="helpCircleOutline" label="Support notes" @tap="notesOpen = true" />
      </template>
    </ScreenHeader>

    <div class="voice__body">
      <!-- Gentle crossfade between states so changes never hard-cut -->
      <Transition name="body-fade" mode="out-in">
        <IdleBody v-if="state === 'idle'" key="idle" @ask="ask" />
        <ListeningBody v-else-if="state === 'listening'" key="listening" />
        <ProcessingBody v-else-if="state === 'processing'" key="processing" />
        <AnsweringBody
          v-else
          key="answering"
          :question="question"
          :answer="answer"
          :done="chatDone"
          :error="chatError"
          :error-message="chatErrorMessage"
          @retry="ask(question)"
        />
      </Transition>
    </div>

    <MicDock
      :listening="state === 'listening'"
      :label="dockLabel"
      :sound-level="soundLevel"
      @mic-tap="onMicTap"
    />

    <NotesSheet :open="notesOpen" @close="notesOpen = false" />

    <IonToast
      :is-open="toast.open"
      :message="toast.message"
      :duration="3500"
      @didDismiss="toast.open = false"
    />
  </div>
</template>

<style scoped>
.voice {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.voice__body {
  flex: 1;
  min-height: 0;
}

.body-fade-enter-active,
.body-fade-leave-active {
  transition: opacity 0.175s ease;
}
.body-fade-enter-from,
.body-fade-leave-to {
  opacity: 0;
}
</style>
