<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { IonPage } from '@ionic/vue';
import { App as CapApp } from '@capacitor/app';
import { useRouter } from 'vue-router';
import MarkdownContent from '@/components/common/MarkdownContent.vue';
import { APP_LANGUAGES, useSettings, type AppLanguage, type TextSizeIndex } from '@/composables/useSettings';
import { firstName, type Profile } from '@/models/profile';
import type { Benefit } from '@/models/benefit';
import { profileService } from '@/services/profileService';
import { benefitService } from '@/services/benefitService';
import { authService } from '@/services/authService';
import { agakApi } from '@/services/agakaiApi';
import { voiceRecorder } from '@/services/voiceRecorder';
import { ttsPlayer } from '@/services/ttsPlayer';

type ChatItem =
  | { id: number; kind: 'user'; text: string }
  | { id: number; kind: 'think' }
  | { id: number; kind: 'agent'; html?: string; markdown?: string; say?: string }
  | {
      id: number;
      kind: 'card-treatment';
      placeName: string;
      placeMeta: string;
      say: string;
    }
  | {
      id: number;
      kind: 'card-benefits';
      items: { icon: string; title: string; subtitle: string; tag: string }[];
      totalCount: number;
      say: string;
    }
  | {
      id: number;
      kind: 'card-friend';
      initials: string;
      name: string;
      subtitle: string;
      say: string;
      responded?: boolean;
    };

type SheetMode = null | 'benefits' | 'about' | 'profile';

const router = useRouter();
const { language, textSizeIndex, setLanguage, setTextSizeIndex } = useSettings();

const profile = ref<Profile | null>(null);
const benefits = ref<Benefit[]>([]);
const userNotes = ref<string | null>(null);

const mainEl = ref<HTMLElement | null>(null);
const txtInput = ref<HTMLInputElement | null>(null);

const messages = ref<ChatItem[]>([]);
const showHello = computed(() => messages.value.length === 0);

const typingMode = ref(false);
const draftText = ref('');
const speaking = ref(false);
const listening = ref(false);
const heardText = ref('');
const menuOpen = ref(false);
const activeSheet = ref<SheetMode>(null);
const toastMessage = ref('');
const toastVisible = ref(false);

let nextId = 1;
let micTimer: ReturnType<typeof setInterval> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let chatGen = 0;

/** Honorific + first name (e.g. "Lola Maria" or "Lolo Miguel"). */
const displayGreetingName = computed(() => {
  if (!profile.value) return 'Lolo Miguel.';
  const honorific = profile.value.gender?.toLowerCase() === 'female' ? 'Lola' : 'Lolo';
  return `${honorific} ${firstName(profile.value)}.`;
});

/** LGU badge text in the top bar. */
const lguBadge = computed(() => {
  const addr = profile.value?.address;
  if (!addr) return 'Brgy. Poblacion LGU';
  const firstPart = addr.split(',')[0]?.trim();
  return firstPart ? `${firstPart} LGU` : 'Brgy. Poblacion LGU';
});

/** Map project benefits to Tala's 4-column icon/title/subtitle/tag structure. */
const mappedBenefits = computed(() => {
  if (benefits.value.length === 0) {
    return [
      { icon: 'cross', title: 'Free medical check-up', subtitle: 'Hospital X, every Monday', tag: 'Active' },
      { icon: 'heart', title: 'Free maintenance medicine', subtitle: 'Barangay health center', tag: 'Active' },
      { icon: 'award', title: 'Social pension ₱500', subtitle: 'Next payout: Nov 5', tag: 'Soon' },
      { icon: 'pin', title: '20% fare discount', subtitle: 'Show your Senior ID', tag: 'Active' },
    ];
  }
  return benefits.value.map((b) => {
    const k = b.iconKey.toLowerCase();
    const icon =
      k.includes('med') || k.includes('health')
        ? 'cross'
        : k.includes('food')
          ? 'heart'
          : k.includes('trans')
            ? 'pin'
            : 'award';
    const tag = b.dateAndLocation.toLowerCase().includes('always') ? 'Active' : 'Active';
    return {
      icon,
      title: b.title,
      subtitle: b.dateAndLocation,
      tag,
    };
  });
});

onMounted(async () => {
  profile.value = await profileService.loadProfileOrNull();
  benefits.value = await benefitService.loadRelevantBenefits(profile.value?.address);
  userNotes.value = await profileService.loadUserNotes();
});

// Android hardware back button handling
let removeBackListener: (() => void) | undefined;
onMounted(async () => {
  const handle = await CapApp.addListener('backButton', () => {
    if (listening.value) {
      stopMic();
    } else if (activeSheet.value || menuOpen.value) {
      closeAllOverlays();
    } else if (typingMode.value) {
      setTyping(false);
    } else if (messages.value.length > 0) {
      messages.value = [];
    } else {
      CapApp.exitApp();
    }
  }).catch(() => null);
  removeBackListener = () => handle?.remove();
});

onBeforeUnmount(() => {
  removeBackListener?.();
  if (micTimer) clearInterval(micTimer);
  if (toastTimer) clearTimeout(toastTimer);
  stopSpeaking();
});

function showToast(text: string) {
  toastMessage.value = text;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 1800);
}

async function scrollToBottom() {
  await nextTick();
  if (mainEl.value) {
    mainEl.value.scrollTop = mainEl.value.scrollHeight;
  }
}

// ---- Speech synthesis (TTS) ----------------------------------------------

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.85;
  u.onstart = () => {
    speaking.value = true;
  };
  u.onend = () => {
    speaking.value = false;
  };
  u.onerror = () => {
    speaking.value = false;
  };
  window.speechSynthesis.speak(u);
}

function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  void ttsPlayer.stop();
  speaking.value = false;
}

// ---- Chat & Rich Cards ---------------------------------------------------

async function ask(questionText: string) {
  const q = questionText.trim();
  if (!q) return;

  const gen = ++chatGen;
  messages.value.push({ id: nextId++, kind: 'user', text: q });
  const thinkId = nextId++;
  messages.value.push({ id: thinkId, kind: 'think' });
  await scrollToBottom();

  const lower = q.toLowerCase();

  // Check if question matches Tala's rich interactive cards (treatment / benefits / friends)
  if (/tambal|hospital|doktor|check-?up|medical|treatment/.test(lower)) {
    setTimeout(async () => {
      if (gen !== chatGen) return;
      removeItem(thinkId);
      const say =
        'Naay libre nga pagpatambal sa Hospital X matag Lunes. Dad-a ang imong Senior ID ug barangay clearance.';
      messages.value.push({
        id: nextId++,
        kind: 'agent',
        html: 'Naay <b>libre nga pagpatambal</b> sa Hospital X matag Lunes. Dad-a ang:<ul><li>Senior ID</li><li>Barangay clearance</li></ul>',
        say,
      });
      messages.value.push({
        id: nextId++,
        kind: 'card-treatment',
        placeName: 'Hospital X',
        placeMeta: '1.2 km · Open today',
        say,
      });
      await scrollToBottom();
      speak(say);
    }, 850);
    return;
  }

  if (/benep|benef/.test(lower)) {
    setTimeout(async () => {
      if (gen !== chatGen) return;
      removeItem(thinkId);
      const count = mappedBenefits.value.length;
      const say = `Naa kay ${count} ka benepisyo. Ang sunod nga pension mao sa Nobyembre singko.`;
      messages.value.push({
        id: nextId++,
        kind: 'card-benefits',
        items: mappedBenefits.value.slice(0, 3),
        totalCount: count,
        say,
      });
      await scrollToBottom();
      speak(say);
    }, 850);
    return;
  }

  if (/lolo|lola|chat|kaibigan|friend|senior/.test(lower)) {
    setTimeout(async () => {
      if (gen !== chatGen) return;
      removeItem(thinkId);
      const say =
        'Si Lolo Ben gikan sa imong barangay mahilig sad og chess. Gusto ba nimo nga ipaila ko siya?';
      messages.value.push({
        id: nextId++,
        kind: 'card-friend',
        initials: 'LB',
        name: 'Lolo Ben',
        subtitle: 'Same barangay · loves chess',
        say,
      });
      await scrollToBottom();
      speak(say);
    }, 850);
    return;
  }

  // Otherwise stream from agakApi (supports Social Pension & general questions)
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

    for await (const event of agakApi.chatStream({ text: q, user: userPayload })) {
      if (gen !== chatGen) return;
      if (event.type === 'delta') {
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
      } else if (event.type === 'done') {
        removeItem(thinkId);
        accumulated = event.answer || accumulated;
        if (agentItemId === null) {
          messages.value.push({ id: nextId++, kind: 'agent', markdown: accumulated, say: accumulated });
        } else {
          const item = messages.value.find((m) => m.id === agentItemId);
          if (item && item.kind === 'agent') {
            item.markdown = accumulated;
            item.say = accumulated;
          }
        }
        await scrollToBottom();
        speak(accumulated.replace(/[*#>_-]/g, ''));
      } else if (event.type === 'error') {
        removeItem(thinkId);
        const fallback = 'Salamat. Tabangan taka ana. Pwede nimo isulti pag-usab?';
        messages.value.push({ id: nextId++, kind: 'agent', html: fallback, say: fallback });
        await scrollToBottom();
        speak(fallback);
      }
    }
  } catch {
    if (gen !== chatGen) return;
    removeItem(thinkId);
    const fallback = 'Salamat. Tabangan taka ana. Pwede nimo isulti pag-usab?';
    messages.value.push({ id: nextId++, kind: 'agent', html: fallback, say: fallback });
    await scrollToBottom();
    speak(fallback);
  }
}

function removeItem(id: number) {
  const idx = messages.value.findIndex((m) => m.id === id);
  if (idx !== -1) messages.value.splice(idx, 1);
}

function respondFriend(item: Extract<ChatItem, { kind: 'card-friend' }>, accept: boolean) {
  if (item.responded) return;
  item.responded = true;
  if (accept) {
    messages.value.push({ id: nextId++, kind: 'user', text: 'Yes, introduce us' });
    void scrollToBottom();
    setTimeout(() => {
      const replyText =
        'Sige! Gipadala na nako ang imong pangalan ni Lolo Ben. Ipahibalo ta ka kung mo-oo siya.';
      messages.value.push({ id: nextId++, kind: 'agent', html: replyText, say: replyText });
      void scrollToBottom();
      speak(replyText);
    }, 500);
  } else {
    messages.value.push({ id: nextId++, kind: 'user', text: 'Not now' });
    void scrollToBottom();
  }
}

// ---- Keyboard / Typebar --------------------------------------------------

async function setTyping(on: boolean) {
  typingMode.value = on;
  await nextTick();
  if (on) txtInput.value?.focus();
  else txtInput.value?.blur();
}

function submitTypebar() {
  const v = draftText.value.trim();
  if (!v) return;
  draftText.value = '';
  void setTyping(false);
  void ask(v);
}

// ---- Microphone / Fullscreen Listening Overlay ---------------------------

const DEMO_UTTERANCE = 'Asa ko pwede mag pa tambal?';

async function startMic() {
  stopSpeaking();
  closeAllOverlays();
  const ok = await voiceRecorder.start();
  if (!ok) {
    showToast('Voice unavailable — tap Type instead');
    return;
  }
  listening.value = true;
  heardText.value = '';
  let n = 0;
  if (micTimer) clearInterval(micTimer);
  micTimer = setInterval(() => {
    n++;
    heardText.value = DEMO_UTTERANCE.slice(0, n * 2);
    if (n * 2 >= DEMO_UTTERANCE.length) {
      stopMic(true);
      void ask(DEMO_UTTERANCE);
    }
  }, 110);
}

function stopMic(finished = false) {
  if (micTimer) {
    clearInterval(micTimer);
    micTimer = null;
  }
  listening.value = false;
  if (!finished) {
    void voiceRecorder.cancel();
  } else {
    void voiceRecorder.stop();
  }
}

// ---- Menu Popover & Bottom Sheets ----------------------------------------

const scrimVisible = computed(() => menuOpen.value || activeSheet.value !== null);

function toggleMenu() {
  if (activeSheet.value) activeSheet.value = null;
  menuOpen.value = !menuOpen.value;
}

function closeAllOverlays() {
  menuOpen.value = false;
  activeSheet.value = null;
}

function openBenefitsSheet() {
  menuOpen.value = false;
  activeSheet.value = 'benefits';
}

function openAboutSheet() {
  menuOpen.value = false;
  activeSheet.value = 'about';
}

function openProfileSheet() {
  menuOpen.value = false;
  activeSheet.value = 'profile';
}

function askMeetFriends() {
  menuOpen.value = false;
  void ask('Naay lain nga lolo nga pwede nako maka-chat?');
}

function selectBenefitFromSheet(title: string) {
  activeSheet.value = null;
  void ask(`Unsaon nako pag-gamit sa ${title}?`);
}

function resetToHome() {
  closeAllOverlays();
  messages.value = [];
}

async function handleLogout() {
  closeAllOverlays();
  stopSpeaking();
  await authService.logout();
  profileService.clear();
  await router.replace('/login');
}
</script>

<template>
  <IonPage>
    <div class="tala-shell">
      <!-- Top Bar -->
      <header class="top">
        <button class="logo" type="button" title="Reset conversation" @click="resetToHome">
          <span class="mark">
            <svg viewBox="0 0 24 24">
              <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
            </svg>
          </span>
          Tala
        </button>
        <button class="chip" type="button" @click="openProfileSheet">
          <svg class="i"><use href="#check" /></svg>
          {{ lguBadge }}
        </button>
      </header>

      <!-- Main Stream -->
      <section ref="mainEl" class="main" aria-live="polite">
        <!-- Greeting + Suggestion Cards (shown when conversation is empty) -->
        <div v-if="showHello" class="hello">
          <h1>
            Maayong adlaw,<br />
            <span class="grad">{{ displayGreetingName }}</span>
          </h1>
          <p class="sub">Tap the mic and just talk.</p>

          <button class="sugg" type="button" @click="ask('Unsa ang akong mga benepisyo?')">
            My benefits
            <svg class="i go"><use href="#go" /></svg>
          </button>
          <button class="sugg" type="button" @click="ask('Asa ko pwede mag pa tambal?')">
            Where can I get treatment?
            <svg class="i go"><use href="#go" /></svg>
          </button>
          <button
            class="sugg"
            type="button"
            @click="ask('Naay lain nga lolo nga pwede nako maka-chat?')"
          >
            Meet other seniors
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
          </div>

          <!-- Agent Bubble -->
          <div v-else-if="item.kind === 'agent'" class="msg agent fade-up">
            <div v-if="item.html" v-html="item.html" />
            <MarkdownContent v-else-if="item.markdown" :source="item.markdown" />
          </div>

          <!-- Rich Card: Treatment / Map -->
          <div v-else-if="item.kind === 'card-treatment'" class="card fade-up">
            <div class="head">
              <svg class="i"><use href="#award" /></svg>
              From your LGU benefits
            </div>
            <div class="body">
              <svg class="map" viewBox="0 0 340 150" preserveAspectRatio="xMidYMid slice">
                <rect width="340" height="150" fill="#DDEBD8" />
                <path
                  d="M-10 110 C80 90 120 130 200 100 S300 60 360 80"
                  stroke="#fff"
                  stroke-width="14"
                  fill="none"
                />
                <path
                  d="M150-10 C140 50 190 90 170 170"
                  stroke="#fff"
                  stroke-width="10"
                  fill="none"
                />
                <path d="M0 40 L340 20" stroke="#F3E9C6" stroke-width="7" />
                <circle cx="260" cy="120" r="34" fill="#BFD9F2" />
                <g transform="translate(168 56)">
                  <circle r="18" fill="#1B3A9E" />
                  <path d="M-3-10h6v7h7v6h-7v7h-6v-7h-7v-6h7z" fill="#fff" />
                </g>
              </svg>
              <div class="place">
                <b>{{ item.placeName }}</b>
                <span>{{ item.placeMeta }}</span>
              </div>
            </div>
            <div class="rowb">
              <button class="btn pri" type="button" @click="showToast('Opening map directions…')">
                <svg class="i"><use href="#pin" /></svg>
                Directions
              </button>
              <button class="btn" type="button" @click="speak(item.say)">
                <svg class="i"><use href="#sound" /></svg>
                Hear again
              </button>
            </div>
          </div>

          <!-- Rich Card: Benefits Summary -->
          <div v-else-if="item.kind === 'card-benefits'" class="card fade-up">
            <div class="head">
              <svg class="i"><use href="#award" /></svg>
              My benefits
            </div>
            <div class="body">
              <div v-for="(b, idx) in item.items" :key="idx" class="li">
                <svg class="i"><use :href="`#${b.icon}`" /></svg>
                <span>
                  {{ b.title }}
                  <small>{{ b.subtitle }}</small>
                </span>
                <span class="tag">{{ b.tag }}</span>
              </div>
            </div>
            <div class="rowb">
              <button class="btn pri" type="button" @click="openBenefitsSheet">
                See all {{ item.totalCount }}
              </button>
              <button class="btn" type="button" @click="speak(item.say)">
                <svg class="i"><use href="#sound" /></svg>
                Hear again
              </button>
            </div>
          </div>

          <!-- Rich Card: Suggested Friend -->
          <div v-else-if="item.kind === 'card-friend'" class="card fade-up">
            <div class="head">
              <svg class="i"><use href="#users" /></svg>
              Suggested friend
            </div>
            <div class="body">
              <div class="li">
                <span class="ava">{{ item.initials }}</span>
                <span>
                  {{ item.name }}
                  <small>{{ item.subtitle }}</small>
                </span>
              </div>
            </div>
            <div class="rowb">
              <button class="btn pri" type="button" @click="respondFriend(item, true)">
                Yes, introduce us
              </button>
              <button class="btn" type="button" @click="respondFriend(item, false)">
                Not now
              </button>
            </div>
          </div>
        </template>
      </section>

      <!-- Bottom Dock: Speaking Status + Typebar / Pill -->
      <div class="dockwrap">
        <div class="status" :class="{ on: speaking }">
          <span>Speaking…</span>
          <button type="button" @click="stopSpeaking">Stop</button>
        </div>

        <form class="typebar" :class="{ on: typingMode }" @submit.prevent="submitTypebar">
          <input
            ref="txtInput"
            v-model="draftText"
            placeholder="Type your question"
            aria-label="Type your question"
            autocomplete="off"
          />
          <button
            type="button"
            class="x"
            aria-label="Close keyboard"
            @click="setTyping(false)"
          >
            <svg class="i"><use href="#x" /></svg>
          </button>
          <button type="submit" class="send" aria-label="Send">
            <svg class="i"><use href="#send" /></svg>
          </button>
        </form>

        <nav class="pill" :class="{ off: typingMode }">
          <button class="db" type="button" @click="setTyping(true)">
            <span class="circle">
              <svg class="i"><use href="#kb" /></svg>
            </span>
            Type
          </button>
          <button class="db m" type="button" @click="startMic">
            <span class="circle">
              <svg class="i"><use href="#mic" /></svg>
            </span>
            Talk
          </button>
          <button
            class="db"
            :class="{ on: menuOpen }"
            type="button"
            aria-haspopup="true"
            @click="toggleMenu"
          >
            <span class="circle">
              <svg class="i"><use href="#menu" /></svg>
            </span>
            Menu
          </button>
        </nav>
      </div>

      <!-- Scrim Backdrop -->
      <div class="scrim" :class="{ on: scrimVisible }" @click="closeAllOverlays" />

      <!-- Menu Popover -->
      <div class="pop" :class="{ on: menuOpen }" role="menu">
        <div class="logo">
          <span class="mark">
            <svg viewBox="0 0 24 24">
              <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
            </svg>
          </span>
          <span>
            Tala
            <small>Senior benefits helper</small>
          </span>
        </div>

        <div class="plabel">Text size</div>
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
            style="font-size: 26px"
            :class="{ on: textSizeIndex === 2 }"
            @click="setTextSizeIndex(2 as TextSizeIndex)"
          >
            Aa
          </button>
        </div>

        <div class="plabel">Language</div>
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

        <button class="it" type="button" @click="openBenefitsSheet">
          <svg class="i"><use href="#award" /></svg>
          View all benefits
        </button>
        <button class="it" type="button" @click="askMeetFriends">
          <svg class="i"><use href="#users" /></svg>
          My friends
        </button>
        <button class="it" type="button" @click="openAboutSheet">
          <svg class="i"><use href="#heart" /></svg>
          What I know about you
        </button>
        <button class="it" type="button" @click="openProfileSheet">
          <svg class="i"><use href="#user" /></svg>
          My profile
        </button>
        <button class="it it--danger" type="button" @click="handleLogout">
          <svg class="i"><use href="#logout" /></svg>
          Log out
        </button>
      </div>

      <!-- Slide-up Bottom Sheet -->
      <aside class="sheet" :class="{ on: activeSheet !== null }" aria-modal="true">
        <div class="grab" />

        <!-- Sheet 1: My Benefits -->
        <template v-if="activeSheet === 'benefits'">
          <h3>My benefits</h3>
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
          <h3>What I know about you</h3>
          <div class="group">
            <div class="li">
              <svg class="i"><use href="#user" /></svg>
              <span>
                {{ profile ? `${profile.name}, ${profile.address}` : 'Lolo Miguel, Brgy. Poblacion' }}
                <small>From your LGU</small>
              </span>
              <span class="tag">LGU</span>
            </div>
            <div class="li">
              <svg class="i"><use href="#heart" /></svg>
              <span>
                You like chess & morning walks
                <small>You told me on Monday</small>
              </span>
              <span class="tag">You</span>
            </div>
            <div class="li">
              <svg class="i"><use href="#sound" /></svg>
              <span>
                You prefer slow speech
                <small>I noticed this</small>
              </span>
              <span class="tag">Me</span>
            </div>
          </div>
          <div v-if="userNotes" class="sheet__notes">
            <MarkdownContent :source="userNotes" variant="notes" />
          </div>
        </template>

        <!-- Sheet 3: Senior Profile Details -->
        <template v-else-if="activeSheet === 'profile'">
          <h3>My profile</h3>
          <div v-if="profile" class="group">
            <div class="li">
              <svg class="i"><use href="#user" /></svg>
              <span>
                {{ profile.name }}
                <small>Senior ID: {{ profile.seniorId }}</small>
              </span>
              <span class="tag">{{ profile.age }} yrs</span>
            </div>
            <div class="li">
              <svg class="i"><use href="#pin" /></svg>
              <span>
                {{ profile.address }}
                <small>Birthday: {{ profile.birthday }}</small>
              </span>
              <span class="tag">LGU</span>
            </div>
            <div class="li">
              <svg class="i"><use href="#phone" /></svg>
              <span>
                {{ profile.mobileNo }}
                <small>{{ profile.email }}</small>
              </span>
            </div>
          </div>
        </template>

        <button class="btn" type="button" style="width: 100%" @click="closeAllOverlays">
          Close
        </button>
      </aside>

      <!-- Fullscreen Listening Orb Overlay -->
      <div class="listen" :class="{ on: listening }" aria-live="assertive">
        <div class="orb" />
        <h2>Listening…</h2>
        <p class="heard">{{ heardText }}</p>
        <button class="btn" type="button" @click="stopMic(false)">Cancel</button>
      </div>

      <!-- Top Toast Notification -->
      <div class="toast" :class="{ on: toastVisible }">{{ toastMessage }}</div>
    </div>
  </IonPage>
</template>

<style scoped>
.tala-shell {
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
  font-size: 22px;
  letter-spacing: -0.02em;
  color: var(--ink);
  text-align: left;
}

.mark {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--grad);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.mark svg {
  width: 22px;
  height: 22px;
  fill: #fff;
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
  font-size: 14px;
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

.think {
  align-self: flex-start;
  display: flex;
  gap: 6px;
  padding: 16px 18px;
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 24px;
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

.card .body {
  background: var(--solid);
  border: 1px solid var(--line);
  border-radius: 20px;
  overflow: hidden;
}

.map {
  height: 150px;
  display: block;
  width: 100%;
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
  grid-template-columns: 1fr 1fr;
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
  font-size: 14px;
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

.status {
  display: none;
  align-self: center;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  padding: 8px 8px 8px 18px;
  border-radius: 30px;
  background: var(--solid);
  border: 1px solid var(--line);
  font-weight: 700;
  font-size: 17px;
}

.status.on {
  display: flex;
}

.status button {
  height: 44px;
  padding: 0 18px;
  border-radius: 22px;
  background: var(--danger);
  color: var(--bg);
  font-weight: 700;
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
  padding: 12px 22px 10px;
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
  font-size: 14px;
  color: var(--muted);
  width: 76px;
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
  font-size: 15px;
  width: 96px;
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
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 22px;
  border-radius: 40px;
  background: var(--glass);
  border: 1px solid var(--a2);
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

.typebar input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--fs);
  color: var(--ink);
  height: 64px;
  outline: none;
}

.typebar input::placeholder {
  color: var(--muted);
}

.typebar .x {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  flex: none;
}

.typebar .send {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--grad);
  color: #fff;
  display: grid;
  place-items: center;
  flex: none;
}

/* Menu popover */
.scrim {
  position: absolute;
  inset: 0;
  background: rgba(3, 4, 8, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 7;
}

.scrim.on {
  opacity: 1;
  pointer-events: auto;
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

.pop .logo {
  padding: 2px 4px 12px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 12px;
}

.pop .logo small {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0;
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
  height: 48px;
  border-radius: 15px;
  font-weight: 700;
  color: var(--muted);
}

.seg button.on {
  background: var(--solid);
  color: var(--a2);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  outline: 1.5px solid var(--a2);
}

.plabel {
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  padding: 0 4px;
}

.pop .it {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  padding: 0 12px;
  border-radius: 16px;
  font-size: 17px;
  font-weight: 600;
  text-align: left;
}

.pop .it:hover,
.pop .it:active {
  background: var(--hi);
}

.pop .it .i {
  color: var(--a2);
  width: 24px;
  height: 24px;
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
  background: radial-gradient(
    circle at 35% 30%,
    #fff 0,
    #9db8ff 30%,
    var(--a2) 70%,
    var(--a1) 120%
  );
  box-shadow: 0 0 80px var(--glow);
  animation: o 1.8s ease-in-out infinite;
}

@keyframes o {
  50% {
    transform: scale(1.15);
    box-shadow: 0 0 120px var(--glow);
  }
}

.listen h2 {
  font-size: calc(var(--fs) * 1.6);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.heard {
  font-size: calc(var(--fs) * 1.1);
  min-height: 2.8em;
  color: var(--muted);
}

.listen .btn {
  padding: 0 40px;
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
  padding: 12px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  transform: translateY(105%);
  transition: transform 0.26s ease;
  max-height: 88%;
  overflow-y: auto;
}

.sheet.on {
  transform: none;
}

.grab {
  width: 48px;
  height: 5px;
  border-radius: 3px;
  background: var(--line);
  margin: 0 auto 14px;
}

.sheet h3 {
  font-size: calc(var(--fs) * 1.2);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 4px 12px;
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

.sheet__notes {
  background: var(--solid);
  border: 1px solid var(--line);
  border-radius: 24px;
  padding: 14px 18px;
  margin-bottom: 12px;
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
  font-size: 17px;
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
