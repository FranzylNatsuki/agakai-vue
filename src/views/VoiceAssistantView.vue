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
import { LiveTranscription } from '@/services/liveTranscription';
import { voiceRecorder } from '@/services/voiceRecorder';
import { ttsPlayer } from '@/services/ttsPlayer';
import { profileService } from '@/services/profileService';
import { useSettings } from '@/composables/useSettings';

type VoiceState = 'idle' | 'listening' | 'processing' | 'answering';

const emit = defineEmits<{ (e: 'back'): void }>();
const { language, t } = useSettings();
const state = ref<VoiceState>('idle');
const question = ref('');
const liveTranscript = ref('');
const answer = ref('');
const chatDone = ref(false);
const chatError = ref(false);
const chatErrorMessage = ref('');
const notesOpen = ref(false);
const toast = ref({ open: false, message: '' });

/** Bumped on every new ask/reset so stale in-flight streams are discarded. */
let chatGen = 0;
let unsubscribePcm: (() => void) | null = null;
let unsubscribeTranscript: (() => void) | null = null;
let liveTranscription: LiveTranscription | null = null;
let transcriptionConnect: Promise<LiveTranscription> | null = null;
let pendingPcm: string[] = [];
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

  liveTranscript.value = '';
  pendingPcm = [];
  unsubscribePcm?.();
  unsubscribeTranscript?.();
  liveTranscription?.close();
  liveTranscription = null;
  transcriptionConnect = null;
  unsubscribePcm = voiceRecorder.onPcmChunk((chunk) => {
    if (liveTranscription) liveTranscription.sendAudio(chunk);
    else if (pendingPcm.length < 48) pendingPcm.push(chunk);
  });
  state.value = 'listening';

  const connection = LiveTranscription.connect();
  transcriptionConnect = connection;
  try {
    const session = await connection;
    if (transcriptionConnect !== connection) {
      session.close();
      return;
    }
    liveTranscription = session;
    unsubscribeTranscript = session.onTranscript((partial, committed) => {
      liveTranscript.value = [committed, partial].filter(Boolean).join(' ').trim();
    });
    for (const chunk of pendingPcm) session.sendAudio(chunk);
    pendingPcm = [];
  } catch {
    if (transcriptionConnect !== connection) return;
    transcriptionConnect = null;
    pendingPcm = [];
    unsubscribePcm?.();
    unsubscribePcm = null;
    if (state.value === 'listening') {
      await voiceRecorder.cancel();
      state.value = 'idle';
      showToast('Live transcription is unavailable. You can type your question instead.');
    }
  }
}

async function stopListening() {
  if (state.value !== 'listening') return;
  state.value = 'processing';

  // Stop capture and flush its last live PCM frames. The recording itself is discarded.
  await voiceRecorder.stop();
  unsubscribePcm?.();
  unsubscribePcm = null;

  let session = liveTranscription;
  if (!session && transcriptionConnect) {
    session = await transcriptionConnect.catch(() => null);
  }
  transcriptionConnect = null;
  pendingPcm = [];
  liveTranscription = null;
  if (!session) {
    unsubscribeTranscript?.();
    unsubscribeTranscript = null;
    liveTranscript.value = '';
    state.value = 'idle';
    showToast('I could not finish speech recognition. You can type your question instead.');
    return;
  }

  let transcript = '';
  try {
    transcript = await session.commit();
  } catch {
    // Do not send an unfinalized partial transcript to Agak.
  }
  session.close();
  unsubscribeTranscript?.();
  unsubscribeTranscript = null;
  if (!transcript.trim()) {
    liveTranscript.value = '';
    state.value = 'idle';
    showToast("I didn't catch that clearly. Please try again or type your question.");
    return;
  }

  question.value = transcript.trim();
  liveTranscript.value = question.value;
  audioChunks = [];
  await runChat({ text: question.value });
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
    for await (const event of agakApi.chatStream({ ...req, user, memoryLanguage: language.value })) {
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
          await ttsPlayer.play(combinedAudio, event.answer);
          break;
        }
        case 'error':
          state.value = 'answering';
          chatError.value = true;
          chatErrorMessage.value = t('chat_error');
          await ttsPlayer.stop();
          break;
      }
    }
  } catch {
    if (gen !== chatGen) return;
    await ttsPlayer.stop();
    state.value = 'answering';
    chatError.value = true;
    chatErrorMessage.value = t('chat_error');
  }
}

async function reset() {
  chatGen++; // discard any in-flight stream
  transcriptionConnect = null;
  pendingPcm = [];
  liveTranscription?.close();
  liveTranscription = null;
  unsubscribePcm?.();
  unsubscribePcm = null;
  unsubscribeTranscript?.();
  unsubscribeTranscript = null;
  await voiceRecorder.cancel();
  liveTranscript.value = '';
  await ttsPlayer.stop();
  ttsPlayer.clearCache();
  audioChunks = [];
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
  transcriptionConnect = null;
  pendingPcm = [];
  liveTranscription?.close();
  liveTranscription = null;
  unsubscribePcm?.();
  unsubscribeTranscript?.();
  void voiceRecorder.cancel();
  void ttsPlayer.stop();
  ttsPlayer.clearCache();
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
        <ListeningBody v-else-if="state === 'listening'" key="listening" :transcript="liveTranscript" />
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
