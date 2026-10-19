<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IonPage } from '@ionic/vue';
import { App as CapApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import type { PluginListenerHandle } from '@capacitor/core';
import { useRouter } from 'vue-router';
import MarkdownContent from '@/components/common/MarkdownContent.vue';
import AppModal from '@/components/common/AppModal.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ProfileDetailRow from '@/components/home/ProfileDetailRow.vue';
import LogoutModal from '@/components/home/LogoutModal.vue';
import LocationMap from '@/components/common/LocationMap.vue';
import { APP_LANGUAGES, useSettings, type AppLanguage, type TextSizeIndex } from '@/composables/useSettings';
import { firstName, type Profile } from '@/models/profile';
import { localizeBenefit, type Benefit } from '@/models/benefit';
import type { MapLocation } from '@/models/mapLocation';
import { mockHealthCenterLocation } from '@/data/mock';
import { profileService } from '@/services/profileService';
import { benefitService } from '@/services/benefitService';
import { authService } from '@/services/authService';
import { agakApi } from '@/services/agakaiApi';
import type { ConversationTurn, SupplementalCardKind } from '@/services/chatCards';
import { voiceRecorder } from '@/services/voiceRecorder';
import { LiveTranscription } from '@/services/liveTranscription';
import { ttsPlayer } from '@/services/ttsPlayer';
import { playCachedGreeting } from '@/services/greetingAudio';
import { clearMemoryTranslations, loadMemoryTranslation, memorySourceHash, saveMemoryTranslation, translateMemory } from '@/services/memoryTranslation';
import { normalizeMemoryHeadings, type Memory } from '@/services/memory';
import { memoryUpdateStatus } from '@/services/memoryUpdateStatus';

type ChatItem =
  | { id: number; kind: 'user'; text: string }
  | { id: number; kind: 'think'; label?: string }
  | {
      id: number;
      kind: 'agent';
      html?: string;
      markdown?: string;
      say?: string;
      audioBytes?: Uint8Array;
    }
  | {
      id: number;
      kind: 'card-treatment';
      placeName: string;
      placeMeta: string;
      placeLocation: MapLocation;
    }
  | {
      id: number;
      kind: 'card-benefits';
      items: { icon: string; title: string; subtitle: string; tag: string }[];
      totalCount: number;
    };

type SheetMode = null | 'benefits' | 'about' | 'profile' | 'mic' | 'map';

const router = useRouter();
const { language, textSizeIndex, setLanguage, setTextSizeIndex, t } = useSettings();

const profile = ref<Profile | null>(null);
const benefits = ref<Benefit[]>([]);
const userNotes = ref<string | null>(null);
const conversationContextReady = ref(false);
const userSummary = ref('');
const memoryOwnerId = ref('anon');
const savedMemoryLanguage = ref<AppLanguage | null>(null);
const memoryLoadedForSheet = ref(false);
const translatedMemory = ref<Memory | null>(null);
const translatedMemorySource = ref<Memory | null>(null);
const translatedMemoryLanguage = ref<AppLanguage | null>(null);
const translatingMemory = ref(false);
const memoryTranslationError = ref(false);
const memoryIsUpdating = memoryUpdateStatus.isUpdating;
const eraseMemoryConfirmOpen = ref(false);
const logoutConfirmOpen = ref(false);

const mainEl = ref<HTMLElement | null>(null);
const txtInput = ref<HTMLTextAreaElement | null>(null);

const messages = ref<ChatItem[]>([]);
const showHello = computed(() => messages.value.length === 0);
const hasMemory = computed(() => !!userSummary.value || !!(userNotes.value ?? '').trim());
const memoryNeedsTranslation = computed(() => {
  if (savedMemoryLanguage.value !== language.value) return true;
  if (language.value !== 'english') return false;
  const tagalogMarkers = `${userSummary.value} ${userNotes.value ?? ''}`
    .toLowerCase()
    .match(/\b(?:mga|ng|tungkol|interesado|benepisyo|alalahanin|kamakailang|paksa|pag-usap)\b/g);
  return (tagalogMarkers?.length ?? 0) >= 2;
});
const isShowingTranslatedMemory = computed(() =>
  translatedMemory.value !== null &&
  memoryNeedsTranslation.value &&
  translatedMemoryLanguage.value === language.value &&
  translatedMemorySource.value?.summary === userSummary.value &&
  translatedMemorySource.value?.notes === (userNotes.value ?? ''),
);
const displayedMemorySummary = computed(() =>
  isShowingTranslatedMemory.value ? translatedMemory.value?.summary ?? '' : userSummary.value,
);
const displayedMemoryNotes = computed(() =>
  normalizeMemoryHeadings(
    isShowingTranslatedMemory.value ? translatedMemory.value?.notes ?? '' : userNotes.value ?? '',
    language.value,
  ),
);
const typingMode = ref(false);
const draftText = ref('');
const keyboardHeight = ref(0);
const speaking = ref(false);
const welcomeAudioPlaying = ref(false);
const agentSpeaking = computed(() => speaking.value || welcomeAudioPlaying.value);
const listening = ref(false);
const soundDb = ref(-60);
const heardText = ref('');
const heardPartialText = ref('');
const menuOpen = ref(false);
// Revert the menu experiment by setting this to false; the original popover styles remain intact.
const MENU_AS_MODAL = true;
const nestedSheetFromMenu = ref(false);
const activeSheet = ref<SheetMode>(null);
const shellEl = ref<HTMLElement | null>(null);
const menuPanelEl = ref<HTMLElement | null>(null);
const sheetPanelEl = ref<HTMLElement | null>(null);
const sheetScrollEl = ref<HTMLDivElement | null>(null);
const sheetTopbarEl = ref<HTMLDivElement | null>(null);
const sheetTopHintTop = ref(68);
const sheetHasMoreBelow = ref(false);
const sheetHasMoreAbove = ref(false);
const overlayHintEl = ref<HTMLButtonElement | null>(null);
const overlayHintTop = ref(0);
const overlayHintLabel = computed(() => t('close_all_overlays_hint'));
const mapLocation = ref<MapLocation>(mockHealthCenterLocation);
const sheetCloseLabel = computed(() => {
  switch (activeSheet.value) {
    case 'benefits': return t('close_benefits');
    case 'about': return t('close_memory');
    case 'profile': return t('close_profile');
    case 'map': return t('close_map');
    case 'mic': return t('close_mic');
    default: return t('close_menu');
  }
});
const micBlocked = ref(false);
const toastMessage = ref('');
const toastVisible = ref(false);

let nextId = 1;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let sheetMutationObserver: MutationObserver | null = null;
let sheetResizeObserver: ResizeObserver | null = null;
let unsubscribeAmp: (() => void) | null = null;
let unsubscribePcm: (() => void) | null = null;
let unsubscribeTranscript: (() => void) | null = null;
let liveTranscription: LiveTranscription | null = null;
let unsubscribeSpeaking: (() => void) | null = null;
let chatGen = 0;
let memoryTranslationController: AbortController | null = null;
let memoryLoadSequence = 0;

/** Live voice level (0..1) mapped to orb scale while listening. */
const orbScale = computed(() => {
  if (!listening.value) return 1;
  const normalized = Math.min(1, Math.max(0, (soundDb.value + 55) / 50));
  return 1 + normalized * 0.12;
});

/** Honorific + first name (e.g. "Lola Maria" or "Lolo Miguel"). */
const displayGreetingName = computed(() => {
  if (!profile.value) return t('default_senior_name');
  const honorific = profile.value.gender?.toLowerCase() === 'female' ? 'Lola' : 'Lolo';
  return `${honorific} ${firstName(profile.value)}.`;
});

/** Barangay scope shown in the top bar. */
const barangayName = computed(() => profile.value?.address.split(',')[0]?.trim() ?? '');

/** Map project benefits to AgakAI's 4-column icon/title/subtitle/tag structure. */
const mappedBenefits = computed(() => {
  if (benefits.value.length === 0) {
    return [
      { icon: 'cross', title: t('demo_medical'), subtitle: t('demo_health_center'), tag: t('active') },
      { icon: 'heart', title: t('demo_discount'), subtitle: t('demo_discount_detail'), tag: t('active') },
      { icon: 'award', title: t('demo_pension'), subtitle: t('demo_national'), tag: t('active') },
      { icon: 'pin', title: t('demo_transport'), subtitle: t('demo_routes'), tag: t('active') },
    ];
  }
  const localeCode = APP_LANGUAGES.find((item) => item.id === language.value)?.code ?? 'en';
  return benefits.value.map((sourceBenefit) => {
    const b = localizeBenefit(sourceBenefit, localeCode);
    const k = b.iconKey.toLowerCase();
    const icon =
      k.includes('med') || k.includes('health')
        ? 'cross'
        : k.includes('food') || k.includes('disc')
          ? 'heart'
          : k.includes('trans')
            ? 'pin'
            : 'award';
    return {
      icon,
      title: b.title,
      subtitle: b.dateAndLocation || b.lgu,
      tag: t('active'),
    };
  });
});

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

let unsubscribeNotes: (() => void) | null = null;
let welcomeAudio: HTMLAudioElement | null = null;
let greetingController: AbortController | null = null;

function stopPlaybackForBackground() {
  if (permissionPromptPending) return;
  stopSpeaking();
}

function handleDocumentVisibilityChange() {
  if (document.visibilityState === 'hidden') stopPlaybackForBackground();
}

function stopWelcomeAudio() {
  greetingController?.abort();
  greetingController = null;
  welcomeAudioPlaying.value = false;
  if (!welcomeAudio) return;
  const audio = welcomeAudio;
  welcomeAudio = null;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  try { audio.currentTime = 0; } catch { /* media may not be ready */ }
}

function playStaticWelcomeAudio() {
  stopWelcomeAudio();
  const locale = APP_LANGUAGES.find((item) => item.id === language.value)?.code ?? 'en';
  const audio = new Audio(`/audio/home/${locale}/welcome.wav`);
  welcomeAudio = audio;
  welcomeAudioPlaying.value = true;
  audio.onended = () => {
    if (welcomeAudio === audio) welcomeAudio = null;
    welcomeAudioPlaying.value = false;
  };
  audio.onerror = () => {
    if (welcomeAudio === audio) welcomeAudio = null;
    welcomeAudioPlaying.value = false;
  };
  void audio.play().catch(() => {
    if (welcomeAudio === audio) welcomeAudio = null;
    welcomeAudioPlaying.value = false;
  });
}

async function playWelcomeAudio(userId: string) {
  stopWelcomeAudio();
  const controller = new AbortController();
  greetingController = controller;
  welcomeAudioPlaying.value = true;
  const greeting = [t('greeting_prefix'), displayGreetingName.value, t('welcome_after_login')]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  try {
    await playCachedGreeting(userId, greeting, language.value, controller.signal);
  } catch {
    if (!controller.signal.aborted) playStaticWelcomeAudio();
  } finally {
    if (greetingController === controller) {
      greetingController = null;
      welcomeAudioPlaying.value = false;
    }
  }
}

onMounted(async () => {
  if (sheetScrollEl.value) {
    sheetMutationObserver = new MutationObserver(() => requestAnimationFrame(updateSheetScrollCue));
    sheetMutationObserver.observe(sheetScrollEl.value, { childList: true, subtree: true, characterData: true });
    if (typeof ResizeObserver !== 'undefined') {
      sheetResizeObserver = new ResizeObserver(() => requestAnimationFrame(updateSheetScrollCue));
      sheetResizeObserver.observe(sheetScrollEl.value);
      if (sheetTopbarEl.value) sheetResizeObserver.observe(sheetTopbarEl.value);
    }
  }
  ttsPlayer.clearCache();
  unsubscribeSpeaking = ttsPlayer.onSpeakingChange((val) => {
    speaking.value = val;
  });
  unsubscribeNotes = profileService.onNotesChange((notes) => {
    userNotes.value = notes;
  });
  const [loadedProfile, greetingUserId] = await Promise.all([
    profileService.loadProfileOrNull(),
    authService.currentUserId(),
  ]);
  profile.value = loadedProfile;
  memoryOwnerId.value = greetingUserId ?? 'anon';
  if (greetingUserId) void playWelcomeAudio(greetingUserId);
  else playStaticWelcomeAudio();
  const [loadedBenefits, memory] = await Promise.all([
    benefitService.loadRelevantBenefits(profile.value?.address),
    profileService.loadMemory(),
  ]);
  benefits.value = loadedBenefits;
  userSummary.value = memory.summary;
  userNotes.value = memory.notes;
  savedMemoryLanguage.value = memory.language;
  conversationContextReady.value = true;
});

// Android hardware back button handling
let removeBackListener: (() => void) | undefined;
let keyboardListenerHandles: PluginListenerHandle[] = [];
let removeAppStateListener: (() => void) | null = null;
let permissionPromptPending = false;
let shellUnmounted = false;

async function attachKeyboardListeners() {
  try {
    const [showHandle, hideHandle] = await Promise.all([
      Keyboard.addListener('keyboardWillShow', ({ keyboardHeight: height }) => {
        keyboardHeight.value = height;
      }),
      Keyboard.addListener('keyboardDidHide', () => {
        keyboardHeight.value = 0;
      }),
    ]);
    if (shellUnmounted) {
      await Promise.all([showHandle.remove(), hideHandle.remove()]);
      return;
    }
    keyboardListenerHandles = [showHandle, hideHandle];
  } catch {
    // Browser preview and unsupported platforms may not provide keyboard events.
  }
}

onMounted(async () => {
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange);
  window.addEventListener('pagehide', stopPlaybackForBackground);
  const appStateHandle = await CapApp.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) stopPlaybackForBackground();
  }).catch(() => null);
  if (appStateHandle) {
    if (shellUnmounted) void appStateHandle.remove();
    else removeAppStateListener = () => { void appStateHandle.remove(); };
  }
  void attachKeyboardListeners();
  const handle = await CapApp.addListener('backButton', () => {
    if (listening.value) {
      void cancelMic();
    } else if (nestedSheetFromMenu.value && activeSheet.value !== null) {
      backToMenu();
    } else if (activeSheet.value || menuOpen.value) {
      closeAllOverlays();
    } else if (typingMode.value) {
      void setTyping(false);
    } else if (messages.value.length > 0) {
      messages.value = [];
    } else {
      CapApp.exitApp();
    }
  }).catch(() => null);
  removeBackListener = () => handle?.remove();
});

onBeforeUnmount(() => {
  shellUnmounted = true;
  keyboardListenerHandles.forEach((handle) => void handle.remove());
  keyboardListenerHandles = [];
  keyboardHeight.value = 0;
  removeBackListener?.();
  removeAppStateListener?.();
  document.removeEventListener('visibilitychange', handleDocumentVisibilityChange);
  window.removeEventListener('pagehide', stopPlaybackForBackground);
  unsubscribeAmp?.();
  unsubscribePcm?.();
  unsubscribeTranscript?.();
  liveTranscription?.close();
  unsubscribeSpeaking?.();
  unsubscribeNotes?.();
  if (toastTimer) clearTimeout(toastTimer);
  void voiceRecorder.cancel();
  stopSpeaking();
  stopWelcomeAudio();
  ttsPlayer.clearCache();
  memoryTranslationController?.abort();
  sheetMutationObserver?.disconnect();
  sheetResizeObserver?.disconnect();
});

function showToast(text: string) {
  toastMessage.value = text;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 2400);
}

async function scrollToBottom() {
  await nextTick();
  if (mainEl.value) {
    mainEl.value.scrollTop = mainEl.value.scrollHeight;
  }
}

// ---- Speech synthesis (TTS) ----------------------------------------------

function speak(text?: string, audioBytes?: Uint8Array) {
  if (!text && (!audioBytes || audioBytes.byteLength === 0)) return;
  stopWelcomeAudio();
  void ttsPlayer.play(audioBytes ?? null, text).catch(() => {
    showToast(t('voice_unavailable')); 
  });
}

function stopSpeaking() {
  stopWelcomeAudio();
  void ttsPlayer.stop();
  speaking.value = false;
}

// ---- Chat & Rich Cards (ElevenLabs speech + Gemini chat) -----------------

async function ask(questionText: string) {
  stopWelcomeAudio();
  const q = questionText.trim();
  if (!q) return;
  await runConversation({ text: q });
}

function appendSupplementalCard(kind: SupplementalCardKind) {
  if (kind === 'map') {
    messages.value.push({
      id: nextId++,
      kind: 'card-treatment',
      placeName: mockHealthCenterLocation.name,
      placeMeta: t('default_city'),
      placeLocation: mockHealthCenterLocation,
    });
  } else if (kind === 'benefits') {
    const count = mappedBenefits.value.length;
    messages.value.push({
      id: nextId++,
      kind: 'card-benefits',
      items: mappedBenefits.value.slice(0, 3),
      totalCount: count,
    });
  }
}

function recentConversationHistory(): ConversationTurn[] {
  return messages.value.flatMap((item): ConversationTurn[] => {
    if (item.kind === 'user') return [{ role: 'user', text: item.text.trim().slice(-500) }];
    if (item.kind === 'agent') {
      const text = (item.say ?? item.markdown ?? '').trim();
      if (text) return [{ role: 'model', text: text.slice(-500) }];
    }
    return [];
  }).slice(-4);
}

async function runConversation(req: {
  text?: string;
  audioBytes?: Uint8Array;
  audioFormat?: string;
  audioMimeType?: string;
}) {
  stopSpeaking();
  const gen = ++chatGen;
  const history = recentConversationHistory();

  const initialQuestion = (req.text ?? '').trim();
  if (initialQuestion) {
    messages.value.push({ id: nextId++, kind: 'user', text: initialQuestion });
  }

  const thinkId = nextId++;
  messages.value.push({
    id: thinkId,
    kind: 'think',
    label: req.audioBytes ? t('transcribing') : undefined,
  });
  await scrollToBottom();

  try {
    const userPayload = profile.value
      ? {
          id: profile.value.id,
          name: profile.value.name,
          age: profile.value.age,
          gender: profile.value.gender,
          address: profile.value.address,
        }
      : null;

    let agentItemId: number | null = null;
    let accumulated = '';
    const audioChunks: Uint8Array[] = [];

    for await (const event of agakApi.chatStream({
      ...req,
      user: userPayload,
      memoryLanguage: language.value,
      history,
      allowCards: true,
      ...(conversationContextReady.value
        ? { benefits: benefits.value, userNotes: userNotes.value ?? '' }
        : {}),
    })) {
      if (gen !== chatGen) return;

      if (event.type === 'transcript') {
        // Insert the transcribed user bubble right before the thinking indicator
        const thinkIdx = messages.value.findIndex((m) => m.id === thinkId);
        const userItem: ChatItem = { id: nextId++, kind: 'user', text: event.question };
        if (thinkIdx !== -1) {
          messages.value.splice(thinkIdx, 0, userItem);
          const thinkItem = messages.value.find((m) => m.id === thinkId);
          if (thinkItem && thinkItem.kind === 'think') {
            thinkItem.label = undefined;
          }
        } else {
          messages.value.push(userItem);
        }
        await scrollToBottom();
      } else if (event.type === 'delta') {
        removeItem(thinkId);
        accumulated += event.text;
        if (agentItemId === null) {
          agentItemId = nextId++;
          messages.value.push({ id: agentItemId, kind: 'agent', markdown: accumulated });
        } else {
          const item = messages.value.find((m) => m.id === agentItemId);
          if (item && item.kind === 'agent') item.markdown = accumulated;
        }
        await scrollToBottom();
      } else if (event.type === 'audio') {
        audioChunks.push(event.chunk);
      } else if (event.type === 'done') {
        removeItem(thinkId);
        accumulated = event.answer || accumulated;
        const combinedAudio =
          audioChunks.length > 0 ? concatUint8Arrays(audioChunks) : undefined;

        if (agentItemId === null) {
          agentItemId = nextId++;
          messages.value.push({
            id: agentItemId,
            kind: 'agent',
            markdown: accumulated,
            say: accumulated,
            audioBytes: combinedAudio,
          });
        } else {
          const item = messages.value.find((m) => m.id === agentItemId);
          if (item && item.kind === 'agent') {
            item.markdown = accumulated;
            item.say = accumulated;
            item.audioBytes = combinedAudio;
          }
        }

        if (event.cardKind) appendSupplementalCard(event.cardKind);
        await scrollToBottom();
        speak(accumulated, combinedAudio);

        // Refresh the memory summary and notes after Gemini updates them
        setTimeout(async () => {
          const memory = await profileService.loadMemory();
          userSummary.value = memory.summary;
          userNotes.value = memory.notes;
          savedMemoryLanguage.value = memory.language;
        }, 2000);
      } else if (event.type === 'error') {
        removeItem(thinkId);
        messages.value.push({
          id: nextId++,
          kind: 'agent',
          markdown: `**${t('apology_prefix')}:** ${t('chat_error')}`,
          say: t('chat_error'),
        });
        await scrollToBottom();
        speak(t('chat_error'));
      }
    }
  } catch (err) {
    if (gen !== chatGen) return;
    removeItem(thinkId);
    const errMsg = t('chat_error');
    messages.value.push({
      id: nextId++,
      kind: 'agent',
      markdown: `**${t('apology_prefix')}:** ${errMsg}`,
      say: errMsg,
    });
    await scrollToBottom();
  }
}

function removeItem(id: number) {
  const idx = messages.value.findIndex((m) => m.id === id);
  if (idx !== -1) messages.value.splice(idx, 1);
}

// ---- Keyboard / Typebar --------------------------------------------------

async function setTyping(on: boolean) {
  typingMode.value = on;
  await nextTick();
  if (on) {
    resizeTypedQuestion();
    txtInput.value?.focus({ preventScroll: true });
  } else txtInput.value?.blur();
}

function resizeTypedQuestion() {
  const input = txtInput.value;
  if (!input) return;
  input.style.height = 'auto';
  const maxHeight = 180;
  const contentHeight = input.scrollHeight;
  input.style.height = `${Math.max(56, Math.min(contentHeight, maxHeight))}px`;
  input.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
}

function discardTypedQuestion() {
  draftText.value = '';
  void setTyping(false);
}

function submitTypebar() {
  const v = draftText.value.trim();
  if (!v) return;
  draftText.value = '';
  void setTyping(false);
  void ask(v);
}

// ---- Microphone permission onboarding ------------------------------------

const MIC_PRIMER_KEY = 'agakai_mic_primer_seen';

function micPrimerSeen(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(MIC_PRIMER_KEY) === '1';
}

function markMicPrimerSeen(): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(MIC_PRIMER_KEY, '1');
}

async function micPermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'unknown';
  }
}

const micCopy = computed(() => ({
  title: t(micBlocked.value ? 'mic_blocked_title' : 'mic_title'),
  body: t(micBlocked.value ? 'mic_blocked_body' : 'mic_body'),
  allow: t(micBlocked.value ? 'try_again' : 'allow_microphone'),
  type: t('type_instead'),
}));

async function enableMic() {
  markMicPrimerSeen();
  micBlocked.value = false;
  activeSheet.value = null;
  await beginListening();
}

function useTypingInstead() {
  markMicPrimerSeen();
  activeSheet.value = null;
  void setTyping(true);
}

// ---- Microphone / Fullscreen Listening Overlay ---------------------------

async function startMic() {
  menuOpen.value = false;
  activeSheet.value = null;
  const state = await micPermissionState();
  if (state === 'denied') {
    micBlocked.value = true;
    activeSheet.value = 'mic';
    return;
  }
  if (state === 'granted' || micPrimerSeen()) {
    await beginListening();
    return;
  }
  micBlocked.value = false;
  activeSheet.value = 'mic';
}

async function beginListening() {
  permissionPromptPending = true;
  let ok = false;
  try {
    ok = await voiceRecorder.start();
  } finally {
    permissionPromptPending = false;
  }
  if (!ok) {
    micBlocked.value = true;
    activeSheet.value = 'mic';
    return;
  }
  stopSpeaking();
  unsubscribeAmp?.();
  soundDb.value = -60;
  unsubscribeAmp = voiceRecorder.onAmplitude((db) => {
    soundDb.value = db;
  });
  listening.value = true;
  heardPartialText.value = '';
  heardText.value = t('connecting_transcription');

  // Keep the first words while the authenticated token and websocket connect.
  const pendingPcm: string[] = [];
  unsubscribePcm?.();
  unsubscribePcm = voiceRecorder.onPcmChunk((chunk) => {
    if (liveTranscription) liveTranscription.sendAudio(chunk);
    else if (pendingPcm.length < 48) pendingPcm.push(chunk);
  });

  try {
    const session = await LiveTranscription.connect();
    if (!listening.value) {
      session.close();
      pendingPcm.length = 0;
      unsubscribePcm?.();
      unsubscribePcm = null;
      return;
    }
    liveTranscription = session;
    unsubscribeTranscript = session.onTranscript((partial, committed) => {
      heardText.value = committed;
      heardPartialText.value = partial;
    });
    for (const chunk of pendingPcm) session.sendAudio(chunk);
    pendingPcm.length = 0;
  } catch {
    pendingPcm.length = 0;
    heardPartialText.value = '';
    unsubscribePcm?.();
    unsubscribePcm = null;
    showToast(t('live_captions_unavailable'));
    heardText.value = t('speak_done_hint');
  }
}

async function finishMicAndAsk() {
  if (!listening.value) return;
  unsubscribeAmp?.();
  unsubscribeAmp = null;
  soundDb.value = -60;
  listening.value = false;

  const session = liveTranscription;
  const format = voiceRecorder.getFormat();
  const mimeType = voiceRecorder.getMimeType();
  // Stop capture before committing, but keep forwarding the final PCM frames.
  const bytes = await voiceRecorder.stop();
  unsubscribePcm?.();
  unsubscribePcm = null;
  liveTranscription = null;

  if (session) {
    let transcript = '';
    try {
      transcript = await session.commit();
    } catch {
      transcript = session.getTranscript();
    }
    session.close();
    unsubscribeTranscript?.();
    unsubscribeTranscript = null;
    if (transcript) {
      await runConversation({ text: transcript });
      return;
    }
    // Do not silently replace a live Cebuano/Tagalog transcript with a second
    // language-detection pass over the recording.
    showToast(t('transcript_finalize_error')); 
    return;
  }

  unsubscribeTranscript?.();
  unsubscribeTranscript = null;
  if (!bytes || bytes.byteLength === 0) {
    showToast(t('transcript_empty_error')); 
    return;
  }
  await runConversation({ audioBytes: bytes, audioFormat: format, audioMimeType: mimeType });
}

async function cancelMic() {
  unsubscribeAmp?.();
  unsubscribeAmp = null;
  unsubscribePcm?.();
  unsubscribePcm = null;
  unsubscribeTranscript?.();
  unsubscribeTranscript = null;
  liveTranscription?.close();
  liveTranscription = null;
  soundDb.value = -60;
  listening.value = false;
  await voiceRecorder.cancel();
}

// ---- Menu Popover & Bottom Sheets ----------------------------------------

const scrimVisible = computed(() => menuOpen.value || activeSheet.value !== null);

function toggleMenu() {
  if (activeSheet.value) {
    closeAllOverlays();
    menuOpen.value = true;
    return;
  }
  menuOpen.value = !menuOpen.value;
}

function cancelMemoryTranslation() {
  memoryTranslationController?.abort();
  memoryTranslationController = null;
  translatingMemory.value = false;
  memoryLoadedForSheet.value = false;
}

function updateSheetScrollCue() {
  const panel = sheetScrollEl.value;
  const sheetRect = sheetPanelEl.value?.getBoundingClientRect();
  const topbarRect = sheetTopbarEl.value?.getBoundingClientRect();
  if (sheetRect && topbarRect) {
    sheetTopHintTop.value = Math.max(0, Math.ceil(topbarRect.bottom - sheetRect.top - 2));
  }
  if (!panel || activeSheet.value === null) {
    sheetHasMoreAbove.value = false;
    sheetHasMoreBelow.value = false;
    return;
  }
  const canScroll = panel.scrollHeight > panel.clientHeight + 8;
  sheetHasMoreAbove.value = canScroll && panel.scrollTop > 12;
  sheetHasMoreBelow.value = canScroll &&
    panel.scrollTop + panel.clientHeight < panel.scrollHeight - 12;
}

function measureOverlayHint() {
  if (!scrimVisible.value || (!activeSheet.value && !MENU_AS_MODAL)) return;
  const shell = shellEl.value?.getBoundingClientRect();
  const panel = activeSheet.value !== null ? sheetPanelEl.value : menuPanelEl.value;
  if (!shell || !panel) return;
  const panelTop = Math.max(0, panel.getBoundingClientRect().top - shell.top);
  const hintHeight = overlayHintEl.value?.offsetHeight ?? 48;
  overlayHintTop.value = Math.max(8, (panelTop - hintHeight) / 2);
}

watch([menuOpen, activeSheet, nestedSheetFromMenu], async () => {
  if (activeSheet.value === null) {
    sheetHasMoreAbove.value = false;
    sheetHasMoreBelow.value = false;
  }
  if (!scrimVisible.value || (!activeSheet.value && !MENU_AS_MODAL)) return;
  await nextTick();
  requestAnimationFrame(() => {
    measureOverlayHint();
    updateSheetScrollCue();
  });
});

function backToMenu() {
  if (!nestedSheetFromMenu.value || activeSheet.value === null) return;
  cancelMemoryTranslation();
  activeSheet.value = null;
}

function handleOverlayBackdrop() {
  closeAllOverlays();
}

function handleNestedSheetTransitionEnd(event: TransitionEvent) {
  if (event.target === event.currentTarget) measureOverlayHint();
}

function closeAllOverlays() {
  if (activeSheet.value === 'mic') markMicPrimerSeen();
  cancelMemoryTranslation();
  menuOpen.value = false;
  activeSheet.value = null;
  nestedSheetFromMenu.value = false;
}

function openBenefitsSheet(fromMenu = false) {
  cancelMemoryTranslation();
  nestedSheetFromMenu.value = fromMenu && MENU_AS_MODAL;
  menuOpen.value = nestedSheetFromMenu.value;
  activeSheet.value = 'benefits';
}

function openLocationMap(location: MapLocation) {
  cancelMemoryTranslation();
  nestedSheetFromMenu.value = false;
  menuOpen.value = false;
  mapLocation.value = location;
  activeSheet.value = 'map';
}

async function openAboutSheet(fromMenu = false) {
  cancelMemoryTranslation();
  nestedSheetFromMenu.value = fromMenu && MENU_AS_MODAL;
  menuOpen.value = nestedSheetFromMenu.value;
  activeSheet.value = 'about';
  memoryTranslationError.value = false;
  await refreshMemoryForSheet();
}

async function refreshMemoryForSheet() {
  const sequence = ++memoryLoadSequence;
  const memory = await profileService.loadMemory();
  if (activeSheet.value !== 'about' || sequence !== memoryLoadSequence) return;
  userSummary.value = memory.summary;
  userNotes.value = memory.notes;
  savedMemoryLanguage.value = memory.language;
  memoryLoadedForSheet.value = true;
  void translateMemoryForOpen();
}

watch(memoryIsUpdating, (isUpdating, wasUpdating) => {
  if (wasUpdating && !isUpdating && activeSheet.value === 'about') {
    void refreshMemoryForSheet();
  }
});

async function translateMemoryForOpen() {
  if (activeSheet.value !== 'about' || !memoryLoadedForSheet.value || !hasMemory.value) return;
  const targetLanguage = language.value;
  if (!memoryNeedsTranslation.value) {
    translatedMemory.value = null;
    translatedMemorySource.value = null;
    translatedMemoryLanguage.value = null;
    memoryTranslationError.value = false;
    return;
  }

  const source: Memory = { summary: userSummary.value, notes: userNotes.value ?? '' };
  const controller = new AbortController();
  memoryTranslationController?.abort();
  memoryTranslationController = controller;
  memoryTranslationError.value = false;

  try {
    const sourceHash = await memorySourceHash(source);
    if (controller.signal.aborted) return;
    const cached = await loadMemoryTranslation(memoryOwnerId.value, sourceHash, targetLanguage);
    if (controller.signal.aborted) return;
    if (cached) {
      translatedMemory.value = cached;
      translatedMemorySource.value = source;
      translatedMemoryLanguage.value = targetLanguage;
      return;
    }

    translatingMemory.value = true;
    const translation = await translateMemory(source, targetLanguage, controller.signal);
    await saveMemoryTranslation(memoryOwnerId.value, sourceHash, targetLanguage, translation);
    if (
      activeSheet.value === 'about' &&
      userSummary.value === source.summary &&
      (userNotes.value ?? '') === source.notes &&
      language.value === targetLanguage
    ) {
      translatedMemory.value = translation;
      translatedMemorySource.value = source;
      translatedMemoryLanguage.value = targetLanguage;
    }
  } catch {
    if (!controller.signal.aborted) memoryTranslationError.value = true;
  } finally {
    if (memoryTranslationController === controller) {
      memoryTranslationController = null;
      translatingMemory.value = false;
    }
  }
}

async function confirmMemoryErase() {
  if (memoryIsUpdating.value) return;
  eraseMemoryConfirmOpen.value = false;
  await clearMemory();
}

async function clearMemory() {
  if (memoryIsUpdating.value) return;
  cancelMemoryTranslation();
  try {
    await profileService.saveMemory('', '');
    clearMemoryTranslations(memoryOwnerId.value);
    translatedMemory.value = null;
    translatedMemorySource.value = null;
    translatedMemoryLanguage.value = null;
    savedMemoryLanguage.value = null;
    memoryTranslationError.value = false;
    userSummary.value = '';
    userNotes.value = '';
    showToast(t('memory_cleared'));
  } catch {
    memoryLoadedForSheet.value = true;
    showToast(t('memory_clear_failed'));
    void translateMemoryForOpen();
  } finally {
    memoryLoadedForSheet.value = true;
  }
}

function openProfileSheet(fromMenu = false) {
  cancelMemoryTranslation();
  nestedSheetFromMenu.value = fromMenu && MENU_AS_MODAL;
  menuOpen.value = nestedSheetFromMenu.value;
  activeSheet.value = 'profile';
}

function askAboutBenefit(title: string) {
  closeAllOverlays();
  void ask(t('faq_benefit_select_prompt', { title }));
}

function selectBenefitFromSheet(title: string) {
  askAboutBenefit(title);
}

async function handleLogout() {
  logoutConfirmOpen.value = false;
  closeAllOverlays();
  stopSpeaking();
  await authService.logout();
  profileService.clear();
  await router.replace('/login');
}
</script>

<template>
  <IonPage>
    <div
      ref="shellEl"
      class="agakai-shell"
      :style="{ paddingBottom: `${keyboardHeight}px` }"
      @keydown.esc="handleOverlayBackdrop"
    >
      <!-- Top Bar -->
      <header class="top">
        <div class="logo">
          <span class="mark"><img src="/assets/mark.png?v=2" alt="" /></span>
          AgakAI
        </div>
        <span v-if="barangayName" class="chip">{{ barangayName }}</span>
      </header>

      <!-- Main Stream -->
      <section ref="mainEl" class="main" aria-live="polite">
        <!-- Greeting + Suggestion Cards (shown when conversation is empty) -->
        <div v-if="showHello" class="hello">
          <h1>
            {{ t('greeting_prefix') }}<br />
            <span class="grad">{{ displayGreetingName }}</span>
          </h1>
          <p class="sub">{{ t('welcome_after_login') }}</p>

          <button class="sugg" type="button" @click="ask(t('faq_prompt_benefits'))">
            {{ t('suggest_benefits') }}
            <svg class="i go"><use href="#go" /></svg>
          </button>
          <button class="sugg" type="button" @click="ask(t('faq_prompt_chat'))">
            {{ t('faq_prompt_chat') }}
            <svg class="i go"><use href="#go" /></svg>
          </button>
        </div>

        <!-- Conversation Items -->
        <template v-for="item in messages" :key="item.id">
          <!-- User Bubble -->
          <div v-if="item.kind === 'user'" class="msg user fade-up">
            {{ item.text }}
          </div>

          <!-- Thinking Dots -->
          <div v-else-if="item.kind === 'think'" class="think fade-in">
            <i /><i /><i />
            <span v-if="item.label" class="think__label">{{ item.label }}</span>
          </div>

          <!-- Agent Bubble -->
          <div v-else-if="item.kind === 'agent'" class="msg agent fade-up">
            <div v-if="item.html" v-html="item.html" />
            <MarkdownContent v-else-if="item.markdown" :source="item.markdown" />
            <button
              v-if="item.say"
              class="msg__speak"
              type="button"
              :aria-label="t('hear_again')"
              @click="speak(item.say, item.audioBytes)"
            >
              <svg class="i"><use href="#sound" /></svg>
              {{ t('hear_again') }}
            </button>
          </div>

          <!-- Rich Card: Treatment / Map -->
          <div v-else-if="item.kind === 'card-treatment'" class="card fade-up">
            <div class="head">
              <svg class="i"><use href="#pin" /></svg>
              {{ t('map_card_title') }}
            </div>
            <p class="map-card-hint">{{ t('map_card_hint') }}</p>
            <div class="body">
              <LocationMap compact :location="item.placeLocation" />
              <div class="place">
                <b>{{ item.placeName }}</b>
                <span>{{ item.placeMeta }}</span>
              </div>
            </div>
            <div class="rowb">
              <button class="btn pri" type="button" @click="openLocationMap(item.placeLocation)">
                <svg class="i"><use href="#pin" /></svg>
                {{ t('show_place_on_map') }}
              </button>
            </div>
          </div>

          <!-- Rich Card: Benefits Summary -->
          <div v-else-if="item.kind === 'card-benefits'" class="card fade-up">
            <div class="head">
              <svg class="i"><use href="#award" /></svg>
              {{ t('suggest_benefits') }}
            </div>
            <p class="benefit-select-hint">{{ t('benefit_ask_hint') }}</p>
            <div class="body">
              <button
                v-for="(b, idx) in item.items"
                :key="idx"
                class="li benefit-result-item"
                type="button"
                @click="askAboutBenefit(b.title)"
              >
                <svg class="i"><use :href="`#${b.icon}`" /></svg>
                <span>
                  {{ b.title }}
                  <small>{{ b.subtitle }}</small>
                </span>
                <span class="tag">{{ b.tag }}</span>
              </button>
            </div>
            <div class="rowb">
              <button class="btn pri" type="button" @click="openBenefitsSheet(false)">
                {{ t('see_all_count', { count: item.totalCount }) }}
              </button>
            </div>
          </div>

        </template>
      </section>

      <!-- Bottom Dock: Typebar / Pill -->
      <div class="dockwrap">
        <form class="typebar" :class="{ on: typingMode }" @submit.prevent="submitTypebar">
          <div class="typebar__input-wrap">
            <textarea
              ref="txtInput"
              v-model="draftText"
              rows="1"
              :placeholder="t('type_question')"
              :aria-label="t('type_question')"
              autocomplete="off"
              @input="resizeTypedQuestion"
              @keydown.escape="setTyping(false)"
              @keydown.enter.exact.prevent="submitTypebar"
            />
            <span v-if="!draftText" class="typebar__placeholder-wrap" aria-hidden="true">
              <span class="typebar__placeholder">{{ t('type_question') }}</span>
            </span>
          </div>
          <div class="typebar__actions">
            <button
              type="button"
              class="x"
              :aria-label="t('discard_question')"
              @click="discardTypedQuestion"
            >
              <svg class="i"><use href="#x" /></svg>
              <span>{{ t('discard_question_short') }}</span>
            </button>
            <button type="submit" class="send" :aria-label="t('ask_agak')">
              <svg class="i"><use href="#send" /></svg>
              <span>{{ t('ask_agak_short') }}</span>
            </button>
          </div>
        </form>

        <nav class="pill" :class="{ off: typingMode }">
          <button class="db" type="button" :aria-label="t('type_a_question')" @click="setTyping(true)">
            <span class="circle">
              <svg class="i"><use href="#kb" /></svg>
            </span>
            {{ t('type_a_question') }}
          </button>
          <button
            class="db m"
            type="button"
            :aria-label="agentSpeaking ? t('stop_agak_speaking') : t('talk_to_agak')"
            :aria-pressed="agentSpeaking"
            @click="agentSpeaking ? stopSpeaking() : startMic()"
          >
            <span class="circle">
              <svg class="i"><use :href="agentSpeaking ? '#stop' : '#mic'" /></svg>
            </span>
            {{ agentSpeaking ? t('stop_agak') : t('talk_to_agak') }}
          </button>
          <button
            class="db"
            :class="{ on: menuOpen }"
            type="button"
            :aria-haspopup="MENU_AS_MODAL ? 'dialog' : 'menu'"
            :aria-label="t('open_menu')"
            :aria-expanded="menuOpen"
            @click="toggleMenu"
          >
            <span class="circle">
              <svg class="i"><use href="#menu" /></svg>
            </span>
            {{ t('open_menu') }}
          </button>
        </nav>
      </div>

      <!-- Scrim Backdrop -->
      <div class="scrim" :class="{ on: scrimVisible }" @click="handleOverlayBackdrop">
        <button
          v-if="activeSheet !== null || (MENU_AS_MODAL && menuOpen)"
          ref="overlayHintEl"
          class="scrim__hint"
          type="button"
          :style="{ top: `${overlayHintTop}px` }"
          @click.stop="handleOverlayBackdrop"
        >
          {{ overlayHintLabel }}
        </button>
      </div>

      <!-- Menu Popover -->
      <div
        ref="menuPanelEl"
        class="pop"
        :class="{ on: menuOpen, 'pop--modal': MENU_AS_MODAL, 'pop--behind-nested': nestedSheetFromMenu && activeSheet !== null }"
        @transitionend="measureOverlayHint"
        :role="MENU_AS_MODAL ? 'dialog' : 'menu'"
        :aria-modal="MENU_AS_MODAL"
        :aria-hidden="!menuOpen || (nestedSheetFromMenu && activeSheet !== null)"
        :inert="nestedSheetFromMenu && activeSheet !== null"
        :aria-label="t('menu')"
      >
        <div class="pop__header">
          <h2 class="pop__title">{{ t('menu') }}</h2>
          <button
            class="pop__close"
            type="button"
            :aria-label="t('close_menu')"
            @click="closeAllOverlays"
          >
            <span aria-hidden="true">×</span>
            {{ t('close_menu') }}
          </button>
        </div>

        <div class="plabel">{{ t('text_size') }}</div>
        <div class="seg">
          <button
            type="button"
            style="font-size: 16px"
            :class="{ on: textSizeIndex === 0 }"
            @click="setTextSizeIndex(0 as TextSizeIndex)"
          >
            Aa
          </button>
          <button
            type="button"
            style="font-size: 20px"
            :class="{ on: textSizeIndex === 1 }"
            @click="setTextSizeIndex(1 as TextSizeIndex)"
          >
            Aa
          </button>
          <button
            type="button"
            style="font-size: 24px"
            :class="{ on: textSizeIndex === 2 }"
            @click="setTextSizeIndex(2 as TextSizeIndex)"
          >
            Aa
          </button>
        </div>

        <div class="plabel">{{ t('language') }}</div>
        <div class="seg">
          <button
            v-for="lang in APP_LANGUAGES"
            :key="lang.id"
            type="button"
            style="font-size: 14px"
            :class="{ on: language === lang.id }"
            @click="setLanguage(lang.id as AppLanguage)"
          >
            {{ lang.nativeLabel }}
          </button>
        </div>

        <button class="it" type="button" @click="openBenefitsSheet(true)">
          <svg class="i"><use href="#award" /></svg>
          <span class="it__label">{{ t('view_all_benefits') }}</span>
        </button>
        <button class="it" type="button" @click="openAboutSheet(true)">
          <svg class="i"><use href="#heart" /></svg>
          <span class="it__label">{{ t('what_i_know') }}</span>
        </button>
        <button class="it" type="button" @click="openProfileSheet(true)">
          <svg class="i"><use href="#user" /></svg>
          <span class="it__label">{{ t('my_profile') }}</span>
        </button>
        <button class="it it--danger" type="button" @click="logoutConfirmOpen = true">
          <svg class="i"><use href="#logout" /></svg>
          <span class="it__label">{{ t('log_out') }}</span>
        </button>
      </div>

      <!-- Slide-up Bottom Sheet -->
      <aside
        ref="sheetPanelEl"
        class="sheet"
        :class="{ on: activeSheet !== null, 'sheet--nested': nestedSheetFromMenu && MENU_AS_MODAL }"
        aria-modal="true"
        :aria-hidden="activeSheet === null"
        @transitionend="handleNestedSheetTransitionEnd"
      >
        <div
          ref="sheetScrollEl"
          class="sheet__scrollable"
          tabindex="0"
          @scroll.passive="updateSheetScrollCue"
        >
          <div ref="sheetTopbarEl" class="sheet__topbar">
          <button
            class="sheet__close"
            type="button"
            :aria-label="nestedSheetFromMenu ? t('back_to_menu') : sheetCloseLabel"
            @click="nestedSheetFromMenu ? backToMenu() : closeAllOverlays()"
          >
            <span aria-hidden="true">{{ nestedSheetFromMenu ? '←' : '×' }}</span>
            {{ nestedSheetFromMenu ? t('back_to_menu') : sheetCloseLabel }}
          </button>
        </div>

        <!-- Sheet 1: My Benefits -->
        <template v-if="activeSheet === 'benefits'">
          <h3>{{ t('suggest_benefits') }}</h3>
          <p class="sheet__benefit-hint">{{ t('benefit_ask_hint') }}</p>
          <div class="group">
            <button
              v-for="(b, idx) in mappedBenefits"
              :key="idx"
              type="button"
              class="li"
              @click="selectBenefitFromSheet(b.title)"
            >
              <svg class="i"><use :href="`#${b.icon}`" /></svg>
              <span>
                {{ b.title }}
                <small>{{ b.subtitle }}</small>
              </span>
              <span class="tag">{{ b.tag }}</span>
            </button>
          </div>
        </template>

        <!-- Sheet 2: What I know about you -->
        <template v-else-if="activeSheet === 'about'">
          <div class="sheet__head">
            <h3>{{ t('what_i_know') }}</h3>
          </div>
          <div v-if="!memoryLoadedForSheet" class="sheet__memory-loading" role="status" aria-live="polite">
            <LoadingSpinner :size="30" aria-hidden="true" />
            <p>{{ t(memoryIsUpdating ? 'memory_generating' : 'memory_loading') }}</p>
          </div>
          <template v-else>
            <div v-if="hasMemory" class="sheet__translation">
              <p v-if="translatingMemory" class="sheet__translation-status" role="status" aria-live="polite">
                <LoadingSpinner :size="18" aria-hidden="true" />
                <span>{{ t('memory_translation_loading') }} {{ t('memory_translation_wait') }}</span>
              </p>
              <p v-if="memoryIsUpdating" class="sheet__translation-status" role="status" aria-live="polite">
                <LoadingSpinner :size="18" aria-hidden="true" />
                <span>{{ t('memory_generating') }}</span>
              </p>
              <p
                v-if="memoryNeedsTranslation && !translatingMemory && !memoryTranslationError"
                class="sheet__translation-note"
              >{{ t('memory_translation_note') }}</p>
              <p v-if="memoryTranslationError" class="sheet__translation-error" role="alert">
                {{ t('memory_translation_error') }}
              </p>
            </div>
            <p v-if="displayedMemorySummary" class="sheet__summary">{{ displayedMemorySummary }}</p>
            <div v-if="hasMemory" class="sheet__notes">
              <MarkdownContent :source="displayedMemoryNotes" variant="notes" />
            </div>
            <div v-if="!hasMemory && memoryIsUpdating" class="sheet__memory-loading" role="status" aria-live="polite">
              <LoadingSpinner :size="30" aria-hidden="true" />
              <p>{{ t('memory_generating') }}</p>
            </div>
            <div v-else-if="!hasMemory" class="sheet__empty">
              <svg class="i"><use href="#heart" /></svg>
              <p>
                <b>{{ t('no_memory') }}</b><br />
                {{ t('memory_intro') }}
              </p>
            </div>
            <button
              v-if="hasMemory"
              class="sheet__clear"
              type="button"
              :disabled="memoryIsUpdating"
              @click="eraseMemoryConfirmOpen = true"
            >
              {{ t('reset_memory') }}
            </button>
          </template>
        </template>

        <!-- Sheet 3: Senior Profile Details -->
        <template v-else-if="activeSheet === 'profile'">
          <h3>{{ t('my_profile') }}</h3>
          <div v-if="profile" class="profile-details">
            <ProfileDetailRow :label="t('name')" :value="profile.name" />
            <ProfileDetailRow :label="t('senior_id')" :value="profile.seniorId" />
            <ProfileDetailRow :label="t('age')" :value="t('age_years', { age: profile.age })" />
            <ProfileDetailRow :label="t('gender')" :value="profile.gender" />
            <ProfileDetailRow :label="t('birthday')" :value="profile.birthday" />
            <ProfileDetailRow :label="t('address')" :value="profile.address" />
            <ProfileDetailRow :label="t('mobile_no')" :value="profile.mobileNo" last />
          </div>
          <p v-else class="profile-details__empty">{{ t('no_profile_data') }}</p>
        </template>

        <!-- Map centered on the senior's current location. Benefit coordinates are not yet available. -->
        <template v-else-if="activeSheet === 'map'">
          <h3>{{ mapLocation.name }}</h3>
          <LocationMap :location="mapLocation" />
        </template>

        <!-- Sheet: Microphone permission guidance -->
        <template v-else-if="activeSheet === 'mic'">
          <div class="mic">
            <div class="mic__badge">
              <svg class="i"><use href="#mic" /></svg>
            </div>
            <h3>{{ micCopy.title }}</h3>
            <p class="mic__body">{{ micCopy.body }}</p>
          </div>
          <button class="btn pri" type="button" style="width: 100%" @click="enableMic">
            {{ micCopy.allow }}
          </button>
          <button class="btn" type="button" style="width: 100%; margin-top: 10px" @click="useTypingInstead">
            {{ micCopy.type }}
          </button>
        </template>
        </div>
        <div
          v-if="sheetHasMoreAbove"
          class="sheet__scroll-hint sheet__scroll-hint--top"
          :style="{ top: `${sheetTopHintTop}px` }"
          aria-hidden="true"
        >
          <span aria-hidden="true">↑</span>
          {{ t('scroll_up_for_top') }}
        </div>
        <div v-if="sheetHasMoreBelow" class="sheet__scroll-hint" aria-hidden="true">
          <span aria-hidden="true">↓</span>
          {{ t('more_below') }}
        </div>
      </aside>

      <!-- Fullscreen Listening Orb Overlay -->
      <div class="listen" :class="{ on: listening }" aria-live="assertive">
        <button
          type="button"
          class="orb"
          :style="{ transform: `scale(${orbScale})` }"
          :aria-label="t('done_speaking')"
          @click="finishMicAndAsk"
        >
          <svg class="i orb__mic"><use href="#mic" /></svg>
        </button>
        <h2>{{ t('listening') }}</h2>
        <p class="heard" aria-live="polite">
          <span>{{ heardText }}</span>
          <span v-if="heardPartialText" class="heard__interim">
            {{ heardText ? ` ${heardPartialText}` : heardPartialText }}
          </span>
        </p>
        <div class="listen__actions">
          <button class="btn pri" type="button" @click="finishMicAndAsk">
            <svg class="i"><use href="#check" /></svg>
            {{ t('done_speaking') }}
          </button>
          <button class="btn" type="button" @click="cancelMic">
            <svg class="i"><use href="#x" /></svg>
            {{ t('cancel') }}
          </button>
        </div>
      </div>

      <!-- Top Toast Notification -->
      <div class="toast" :class="{ on: toastVisible }">{{ toastMessage }}</div>
    </div>
    <AppModal
      :open="eraseMemoryConfirmOpen"
      :title="t('erase_memory_confirmation_title')"
      :confirm-text="t('reset_memory')"
      danger
      @cancel="eraseMemoryConfirmOpen = false"
      @confirm="confirmMemoryErase"
    >
      <p class="erase-memory-confirm-copy">{{ t('erase_memory_confirmation_body') }}</p>
    </AppModal>
    <LogoutModal
      :open="logoutConfirmOpen"
      @cancel="logoutConfirmOpen = false"
      @confirm="handleLogout"
    />
  </IonPage>
</template>

<style scoped>
.erase-memory-confirm-copy {
  margin: 0;
  color: var(--muted);
  font-size: var(--fs);
  line-height: 1.45;
}

.agakai-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  color: var(--ink);
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px 4px;
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: calc(22px * var(--text-scale, 1));
  letter-spacing: -0.02em;
  color: var(--ink);
  text-align: left;
}

.mark {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: transparent;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 18px;
  background: var(--glass);
  border: 1px solid var(--line);
  font-size: calc(14px * var(--text-scale, 1));
  font-weight: 600;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.chip .i {
  width: 16px;
  height: 16px;
  color: #16a34a;
}

.main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 22px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 24px);
  mask-image: linear-gradient(to bottom, transparent 0, #000 24px);
}

.hello {
  margin: auto 0 6px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h1 {
  font-size: calc(var(--fs) * 1.9);
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -0.035em;
  margin: 0;
}

.grad {
  background: linear-gradient(110deg, var(--ink) 10%, var(--a2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.sub {
  color: var(--muted);
  font-size: calc(var(--fs) * 0.85);
  line-height: 1.4;
  margin-bottom: 4px;
}

.sugg {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  text-align: left;
  min-height: 70px;
  padding: 12px 16px;
  border-radius: 22px;
  background: var(--solid);
  border: 0;
  font-size: var(--fs);
  font-weight: 600;
  letter-spacing: -0.01em;
  box-shadow: 0 1px 2px rgba(10, 20, 50, 0.06), 0 8px 24px rgba(10, 20, 50, 0.1);
  transition: transform 0.15s, box-shadow 0.15s;
}

.sugg:hover {
  box-shadow: 0 1px 2px rgba(10, 20, 50, 0.08), 0 12px 30px rgba(10, 20, 50, 0.16);
}

.sugg:active {
  transform: scale(0.985);
}

.sugg .go {
  margin-left: auto;
  color: var(--muted);
  width: 22px;
  height: 22px;
}

.msg {
  max-width: 90%;
  padding: 13px 18px;
  border-radius: 24px;
  font-size: var(--fs);
  line-height: 1.4;
  letter-spacing: -0.005em;
}

.msg.user {
  align-self: flex-end;
  background: var(--grad);
  color: #fff;
  border-bottom-right-radius: 8px;
}

.msg.agent {
  align-self: flex-start;
  background: var(--glass);
  border: 1px solid var(--line);
  border-bottom-left-radius: 8px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.msg :deep(ul) {
  margin: 6px 0 0 22px;
  padding: 0;
}

.msg__speak {
  width: 100%;
  min-height: 58px;
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--hi);
  color: var(--a2);
  font-size: calc(var(--fs) * 0.82);
  line-height: 1.25;
  font-weight: 700;
  transition: transform 140ms ease, background-color 180ms ease;
}
.msg__speak:active { transform: scale(0.98); }

.msg__speak .i {
  width: 24px;
  height: 24px;
}

.think {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 16px 18px;
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 24px;
}

.think__label {
  margin-left: 6px;
  font-size: calc(14px * var(--text-scale, 1));
  font-weight: 600;
  color: var(--muted);
}

.think i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--a2);
  animation: b 1s infinite;
}

.think i:nth-child(2) {
  animation-delay: 0.15s;
}

.think i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes b {
  50% {
    opacity: 0.25;
    transform: translateY(-3px);
  }
}

.card {
  align-self: stretch;
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 26px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.card .head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 0;
  color: var(--muted);
  font-size: calc(var(--fs) * 0.78);
  font-weight: 600;
}

.card .head .i {
  width: 18px;
  height: 18px;
}

.benefit-select-hint,
.map-card-hint {
  margin: 0 10px;
  color: var(--muted);
  font-size: calc(var(--fs) * 0.78);
  line-height: 1.35;
}

.benefit-result-item {
  border: 0;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}

.benefit-result-item:active {
  background: var(--hi);
}

.card .body {
  background: var(--solid);
  border: 1px solid var(--line);
  border-radius: 20px;
  overflow: hidden;
}


.place {
  padding: 12px 16px;
  font-size: var(--fs);
  line-height: 1.3;
}

.place b {
  display: block;
  font-weight: 700;
}

.place span {
  color: var(--muted);
  font-size: calc(var(--fs) * 0.82);
}

.btn {
  min-height: 56px;
  border-radius: 20px;
  background: var(--glass);
  font-weight: 700;
  font-size: calc(var(--fs) * 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--line);
  padding: 0 12px;
}

.btn.pri {
  background: var(--grad);
  color: #fff;
  border-color: transparent;
}

.rowb {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  font-size: var(--fs);
  width: 100%;
  text-align: left;
  font-weight: 500;
}

.li:first-child {
  border-top: 0;
}

.li small {
  display: block;
  color: var(--muted);
  font-size: calc(var(--fs) * 0.78);
  font-weight: 400;
}

.li .i {
  color: var(--a2);
}

.li .tag {
  margin-left: auto;
  font-size: calc(14px * var(--text-scale, 1));
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 14px;
  background: var(--hi);
  color: var(--a2);
  white-space: nowrap;
}

.ava {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--grad);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  flex: none;
}

.dockwrap {
  padding: 6px 14px calc(16px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  position: relative;
  flex-shrink: 0;
}

/* The pill: keyboard / mic / menu */
.pill {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 12px 8px 10px;
  border-radius: 44px;
  background: var(--glass);
  border: 1px solid var(--line);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.db {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  font-weight: 600;
  font-size: calc(12px * var(--text-scale, 1));
  line-height: 1.15;
  text-align: center;
  color: var(--muted);
  flex: 1 1 0;
  min-width: 0;
}

.circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--solid);
  border: 1px solid var(--line);
  color: var(--ink);
  transition: transform 0.12s;
}

.db:active .circle {
  transform: scale(0.92);
}

.db.m {
  color: var(--ink);
  font-size: calc(12px * var(--text-scale, 1));
  flex: 1.15 1 0;
}

.db.m .circle {
  width: 84px;
  height: 84px;
  margin-top: -26px;
  background: var(--grad);
  border: 0;
  color: #fff;
  box-shadow: 0 10px 26px var(--glow);
}

.db.m .circle .i {
  width: 36px;
  height: 36px;
}

.db.on .circle {
  border-color: var(--a2);
  color: var(--a2);
}

.typebar {
  display: none;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--a2);
  border-radius: 24px;
  background: var(--glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
}

.typebar.on {
  display: flex;
}

.pill.off {
  display: none;
}

.typebar__input-wrap {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 56px;
  max-height: 180px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--solid);
}

.typebar textarea {
  display: block;
  width: 100%;
  min-height: 56px;
  max-height: 180px;
  box-sizing: border-box;
  resize: none;
  overflow-y: hidden;
  border: 0;
  padding: 10px;
  outline: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--fs);
  line-height: 1.3;
}

.typebar textarea::placeholder {
  color: transparent;
}

.typebar__placeholder-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  overflow: hidden;
  box-sizing: border-box;
  padding: 12px 10px;
  pointer-events: none;
}

.typebar__placeholder {
  display: -webkit-box;
  width: 100%;
  min-width: 0;
  max-height: calc(2 * 1.15em);
  overflow: hidden;
  color: var(--muted);
  font-size: calc(var(--fs) * 0.7);
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: normal;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.typebar__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.typebar .x,
.typebar .send {
  display: inline-flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  min-height: 52px;
  padding: 0 12px;
  border-radius: 20px;
  white-space: nowrap;
  font-size: calc(14px * var(--text-scale, 1));
  line-height: 1.15;
  font-weight: 700;
}

.typebar .x {
  border: 1px solid var(--line);
  color: var(--brand-slate);
}

.typebar .send {
  background: var(--a2);
  color: #fff;
}

.typebar .x .i,
.typebar .send .i {
  flex: none;
  width: 18px;
  height: 18px;
}

@media (max-width: 400px) {
  .typebar__actions {
    gap: 8px;
  }
  .typebar .x,
  .typebar .send {
    padding: 0 8px;
    font-size: calc(13px * var(--text-scale, 1));
  }
}

/* Menu overlay; MENU_AS_MODAL switches between the reversible modal and original popover. */
.scrim {
  position: absolute;
  inset: 0;
  background: rgba(3, 4, 8, 0.6);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 7;
}

.scrim.on {
  opacity: 1;
  pointer-events: auto;
}

.scrim__hint {
  position: absolute;
  left: 50%;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: max-content;
  max-width: min(90%, 340px);
  min-height: 56px;
  padding: 12px 20px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--solid);
  box-shadow: none;

  font: inherit;
  font-size: calc(16px * var(--text-scale, 1));
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  cursor: pointer;
  touch-action: manipulation;
  transform: translateX(-50%);
}

.pop {
  position: absolute;
  right: 14px;
  bottom: 128px;
  width: 318px;
  z-index: 9;
  background: var(--solid);
  border: 1px solid var(--line);
  border-radius: 28px;
  padding: 14px;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.35);
  transform-origin: bottom right;
  transform: scale(0.88) translateY(12px);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity 0.15s;
}

.pop.on {
  transform: none;
  opacity: 1;
  pointer-events: auto;
}

.pop--behind-nested {
  z-index: 8;
}

.pop--modal {
  left: 0;
  right: 0;
  bottom: 0;
  width: auto;
  border-radius: 32px 32px 0 0;
  padding: 12px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  height: 72%;
  max-height: 72%;
  overflow-y: auto;
  transform: translateY(105%);
  transform-origin: bottom;
  opacity: 1;
  transition: transform 0.26s ease;
}

.pop--modal.on {
  transform: none;
}

.pop--modal .pop__header {
  position: sticky;
  top: -12px;
  z-index: 2;
  background: var(--solid);
  padding-top: 12px;
}

.pop__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding: 0 0 10px;
  border-bottom: 1px solid var(--line);
}

.pop__title {
  min-width: 0;
  margin: 0 4px;
  color: var(--ink);
  font-size: calc(var(--fs) * 0.95);
  line-height: 1.2;
  font-weight: 700;
}

.pop__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 48px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--hi);
  color: var(--a2);
  font-size: calc(var(--fs) * 0.68);
  line-height: 1.15;
  min-width: 0;
  flex-shrink: 1;
  font-weight: 700;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: center;
}

.pop__close span {
  font-size: 1.35em;
  line-height: 1;
}

.seg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 5px;
  background: var(--hi);
  border-radius: 20px;
  margin: 4px 0 12px;
}

.seg button {
  min-width: 0;
  height: 48px;
  padding: 2px;
  border-radius: 15px;
  font-weight: 700;
  line-height: 1.15;
  white-space: normal;
  overflow-wrap: anywhere;
  color: var(--muted);
}

.seg button.on {
  background: var(--solid);
  color: var(--a2);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  outline: 1.5px solid var(--a2);
}

.plabel {
  font-size: calc(14px * var(--text-scale, 1));
  font-weight: 600;
  color: var(--muted);
  padding: 0 4px;
}

.pop .it {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  min-height: 52px;
  padding: 8px 12px;
  border-radius: 16px;
  font-size: calc(17px * var(--text-scale, 1));
  font-weight: 600;
  text-align: left;
}

.pop .it:hover,
.pop .it:active {
  background: var(--hi);
}

.pop .it .i {
  flex: 0 0 24px;
  color: var(--a2);
  width: 24px;
  height: 24px;
}

.pop .it__label {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.3;
}

.pop .it--danger {
  color: var(--danger);
}

.pop .it--danger .i {
  color: var(--danger);
}

/* Fullscreen Listening Overlay */
.listen {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 26px;
  text-align: center;
  padding: 30px;
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s;
}

.listen.on {
  opacity: 1;
  pointer-events: auto;
}

.orb {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: var(--grad);
  box-shadow: 0 10px 26px var(--glow);
  display: grid;
  place-items: center;
  color: #fff;
  transition: transform 0.12s ease-out;
}

.orb__mic {
  width: 52px;
  height: 52px;
  stroke: #fff;
}

.listen h2 {
  font-size: calc(var(--fs) * 1.6);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.heard {
  font-size: calc(var(--fs) * 1.02);
  min-height: 2.8em;
  color: var(--muted);
}

.heard__interim {
  font-style: italic;
  opacity: 0.68;
}

.listen__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 280px;
}

.listen .btn {
  padding: 0 28px;
  width: 100%;
}

/* Bottom Sheet */
.sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 8;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 32px 32px 0 0;
  height: 72%;
  max-height: 72%;
  padding: 0;
  overflow: hidden;
  transform: translateY(105%);
  transition: transform 0.26s ease;
}

.sheet__scrollable {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px 16px calc(76px + env(safe-area-inset-bottom, 0px));
  scrollbar-width: thin;
  scrollbar-color: var(--brand-blue) transparent;
}

.sheet__scrollable::-webkit-scrollbar {
  width: 6px;
}

.sheet__scrollable::-webkit-scrollbar-thumb {
  border-radius: 8px;
  background: var(--brand-blue);
}

.sheet__scroll-hint {
  position: absolute;
  right: 10px;
  bottom: 0;
  left: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 56px;
  padding: 8px 16px calc(10px + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(to bottom, transparent, var(--bg) 40%);
  color: var(--brand-slate);
  font-size: calc(14px * var(--text-scale, 1));
  font-weight: 700;
  pointer-events: none;
}

.sheet__scroll-hint--top {
  bottom: auto;
  padding: 8px 16px;
  background: var(--bg);
}

.sheet__scroll-hint span {
  font-size: 1.3em;
  line-height: 1;
}

.sheet.on {
  transform: none;
}

.sheet--nested {
  z-index: 10;
  transform: scale(0.97);
  transform-origin: center bottom;
  opacity: 0;
  pointer-events: none;
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.sheet--nested.on {
  transform: scale(1);
  opacity: 1;
  pointer-events: auto;
}

.sheet__topbar {
  position: sticky;
  top: -12px;
  /* Leaflet controls reach z-index 1000; keep Back to menu/Close above them. */
  z-index: 1101;
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin: -12px -16px 12px;
  padding: 12px 16px 8px;
  background: var(--bg);
}

.sheet__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  min-height: 48px;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--hi);
  color: var(--a2);
  font-size: calc(var(--fs) * 0.78);
  line-height: 1.2;
  font-weight: 700;
}

.sheet__close span {
  font-size: 1.3em;
  line-height: 1;
}

.sheet__close:active {
  background: var(--solid);
}

.sheet h3 {
  font-size: calc(var(--fs) * 1.2);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 4px 12px;
}

.sheet__benefit-hint {
  margin: -4px 4px 12px;
  color: var(--muted);
  font-size: calc(var(--fs) * 0.78);
  line-height: 1.4;
}

.profile-details {
  padding: 0 4px 12px;
}

.profile-details__empty {
  padding: 16px 4px;
  font-size: var(--fs);
  line-height: 1.4;
  color: var(--muted);
}

.group {
  background: var(--solid);
  border: 1px solid var(--line);
  border-radius: 24px;
  overflow: hidden;
  margin-bottom: 12px;
}

.group .li:active {
  background: var(--hi);
}

.sheet__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.sheet__head h3 {
  margin: 0 4px;
}

.sheet__clear {
  display: block;
  width: 100%;
  min-height: 52px;
  margin-top: 24px;
  padding: 12px 16px;
  border: 1px solid var(--danger-border);
  border-radius: 16px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: calc(var(--fs) * 0.78);
  font-weight: 700;
  text-align: center;
  cursor: pointer;
}

.sheet__clear:active:not(:disabled) {
  background: var(--danger-border);
}

.sheet__clear:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.sheet__translation {
  margin: 0 4px 12px;
}

.sheet__translation-note,
.sheet__translation-error,
.sheet__translation-status {
  margin: 7px 4px 0;
  font-size: calc(var(--fs) * 0.72);
  line-height: 1.35;
}

.sheet__translation-status {
  display: flex;
  align-items: center;
  gap: 9px;
}

.sheet__memory-loading {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px 16px;
  color: var(--muted);
  text-align: center;
}

.sheet__memory-loading p {
  max-width: 28ch;
  margin: 0;
  font-size: calc(var(--fs) * 0.9);
  line-height: 1.4;
}

.sheet__translation-note,
.sheet__translation-status {
  color: var(--muted);
}

.sheet__translation-error {
  color: var(--danger);
}

.sheet__notes {
  background: var(--solid);
  border: 1px solid var(--line);
  border-radius: 24px;
  padding: 14px 18px;
  margin-bottom: 12px;
}

.sheet__summary {
  margin: 0 4px 12px;
  font-size: calc(var(--fs) * 0.95);
  line-height: 1.45;
  color: var(--ink);
}

.mic {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  margin: 8px 0 18px;
}

.mic__badge {
  width: 64px;
  height: 64px;
  border-radius: 24px;
  background: var(--grad);
  display: grid;
  place-items: center;
}

.mic__badge .i {
  width: 28px;
  height: 28px;
  color: #fff;
  stroke: #fff;
}

.mic h3 {
  margin: 0;
  font-size: calc(var(--fs) * 1.1);
  font-weight: 800;
  color: var(--ink);
}

.mic__body {
  margin: 0;
  font-size: calc(var(--fs) * 0.92);
  line-height: 1.5;
  color: var(--muted);
}

.sheet__empty {
  background: var(--solid);
  border: 1px dashed var(--line);
  border-radius: 24px;
  padding: 18px;
  margin-bottom: 12px;
  text-align: center;
}

.sheet__empty-title {
  font-size: calc(var(--fs) * 0.98);
  font-weight: 800;
  color: var(--ink);
  margin: 0 0 6px;
}

.sheet__empty-sub {
  font-size: calc(var(--fs) * 0.85);
  line-height: 1.4;
  color: var(--muted);
  margin: 0;
}

.toast {
  position: absolute;
  left: 50%;
  top: 72px;
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--bg);
  padding: 12px 20px;
  border-radius: 24px;
  font-weight: 700;
  font-size: calc(17px * var(--text-scale, 1));
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  z-index: 11;
  white-space: nowrap;
}

.toast.on {
  opacity: 1;
}
</style>
