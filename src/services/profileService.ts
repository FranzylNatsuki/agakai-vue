import { appConfig, isBackendConfigured } from '@/services/appConfig';
import { authService } from '@/services/authService';
import { getSupabase } from '@/services/supabase';
import { mockProfile, mockUserNotes } from '@/data/mock';
import { profileFromJson, type Profile } from '@/models/profile';
import type { AppLanguage } from '@/composables/useSettings';
import { MEMORY_NOTES_MAX_CHARS, MEMORY_SUMMARY_MAX_CHARS } from '@/services/memory';
import { memorySourceHash } from '@/services/memoryTranslation';

const USER_NOTES_STORAGE_PREFIX = 'agakai_user_notes_';
const SUMMARY_STORAGE_PREFIX = 'agakai_user_summary_';
const MEMORY_LANGUAGE_STORAGE_PREFIX = 'agakai_memory_language_';
const MEMORY_TRANSLATION_STORAGE_PREFIX = 'agakai_memory_translation_';
const notesListeners = new Set<(notes: string) => void>();

function notifyNotesListeners(notes: string) {
  for (const cb of notesListeners) {
    cb(notes);
  }
}

function localNotesKey(authUserId: string | null): string {
  return `${USER_NOTES_STORAGE_PREFIX}${authUserId ?? 'anon'}`;
}

async function memoryLanguageFor(
  userId: string | null,
  summary: string,
  notes: string,
): Promise<AppLanguage | null> {
  if (!summary && !notes) return null;
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${MEMORY_LANGUAGE_STORAGE_PREFIX}${userId ?? 'anon'}`);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { hash?: unknown; language?: unknown };
    if (!['english', 'cebuano', 'tagalog'].includes(String(saved.language))) return null;
    const hash = await memorySourceHash({ summary, notes });
    return saved.hash === hash ? saved.language as AppLanguage : null;
  } catch {
    return null;
  }
}

export const profileService = {
  /** The authenticated owner of the profile row; RLS uses the same id. */
  async currentUserId(): Promise<string | null> {
    return authService.currentUserId();
  },

  /** Subscribe to live updates whenever `user_notes` changes. */
  onNotesChange(cb: (notes: string) => void): () => void {
    notesListeners.add(cb);
    return () => {
      notesListeners.delete(cb);
    };
  },

  /** Loads the signed-in senior's own record. RLS returns at most one row. */
  async loadProfile(): Promise<Profile> {
    const userId = await authService.currentUserId();

    if (isBackendConfigured() && userId) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (!error && data) return profileFromJson(data);
    }

    if (!isBackendConfigured() && appConfig.useMockData) return mockProfile;

    throw new Error('Please sign in to view your profile.');
  },

  async loadProfileOrNull(): Promise<Profile | null> {
    try {
      return await this.loadProfile();
    } catch {
      return null;
    }
  },

  /** Loads the short summary and the detailed notes together. */
  async loadMemory(): Promise<{ summary: string; notes: string; language: AppLanguage | null }> {
    const userId = await authService.currentUserId();

    if (isBackendConfigured() && userId) {
      try {
        const { data, error } = await getSupabase()
          .from('user')
          .select('user_notes, user_summary')
          .eq('auth_user_id', userId)
          .maybeSingle();

        if (!error && data) {
          const rawSummary = data.user_summary ?? '';
          const rawNotes = data.user_notes ?? '';
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(`${SUMMARY_STORAGE_PREFIX}${userId}`, rawSummary);
              localStorage.setItem(localNotesKey(userId), rawNotes);
            } catch {
              // Continue with the server result if local caching is unavailable.
            }
          }
          const language = await memoryLanguageFor(userId, rawSummary.trim(), rawNotes.trim());
          const summary = rawSummary.replace(/\s+/g, ' ').trim();
          const notes = rawNotes.trim();
          return { summary, notes, language };
        }
      } catch {
        // Fall through to the local cache.
      }
    }

    if (typeof localStorage !== 'undefined') {
      const rawSummary = localStorage.getItem(`${SUMMARY_STORAGE_PREFIX}${userId}`) ?? '';
      const rawNotes = localStorage.getItem(localNotesKey(userId)) ?? '';
      const language = await memoryLanguageFor(userId, rawSummary.trim(), rawNotes.trim());
      const summary = rawSummary.replace(/\s+/g, ' ').trim();
      const notes = rawNotes.trim();
      return { summary, notes, language };
    }

    return { summary: '', notes: '', language: null };
  },

  /** Writes both memory fields in one update; column grants allow only these. */
  async saveMemory(summary: string, notes: string, language?: AppLanguage): Promise<void> {
    const cleanSummary = summary.replace(/\s+/g, ' ').trim();
    const cleanNotes = notes.trim();
    if (cleanSummary.length > MEMORY_SUMMARY_MAX_CHARS || cleanNotes.length > MEMORY_NOTES_MAX_CHARS) return;
    const userId = await authService.currentUserId();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${SUMMARY_STORAGE_PREFIX}${userId}`, cleanSummary);
      localStorage.setItem(localNotesKey(userId), cleanNotes);
      const languageKey = `${MEMORY_LANGUAGE_STORAGE_PREFIX}${userId ?? 'anon'}`;
      if (!cleanSummary && !cleanNotes) {
        localStorage.removeItem(languageKey);
      } else if (language) {
        try {
          const hash = await memorySourceHash({ summary: cleanSummary, notes: cleanNotes });
          localStorage.setItem(languageKey, JSON.stringify({ hash, language }));
        } catch {
          localStorage.removeItem(languageKey);
        }
      }
    }
    notifyNotesListeners(cleanNotes);

    if (isBackendConfigured() && userId) {
      try {
        await getSupabase()
          .from('user')
          .update({ user_notes: cleanNotes, user_summary: cleanSummary })
          .eq('auth_user_id', userId);
      } catch {
        // Offline: the local cache still has the memory.
      }
    }
  },

  /** Loads this senior's rolling memory note. Returns "" when there is none. */
  async loadUserNotes(): Promise<string | null> {
    const userId = await authService.currentUserId();
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(localNotesKey(userId));
      if (cached !== null) return cached;
    }

    if (isBackendConfigured() && userId) {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('user')
          .select('user_notes')
          .eq('auth_user_id', userId)
          .maybeSingle();

        if (!error && data) {
          const notes = (data.user_notes ?? '').trim();
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(localNotesKey(userId), notes);
          }
          return notes;
        }
      } catch {
        // Fall through to the local cache.
      }
    }

    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(localNotesKey(userId));
      if (saved !== null) return saved;
    }

    if (!isBackendConfigured() && appConfig.useMockData) return mockUserNotes;

    return '';
  },

  /** Persists the memory note. Column grants limit senior writes to this field. */
  async saveUserNotes(notes: string): Promise<void> {
    const clean = notes.trim();
    if (clean.length > MEMORY_NOTES_MAX_CHARS) return;
    const userId = await authService.currentUserId();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(localNotesKey(userId), clean);
    }
    notifyNotesListeners(clean);

    if (isBackendConfigured() && userId) {
      try {
        await getSupabase()
          .from('user')
          .update({ user_notes: clean })
          .eq('auth_user_id', userId);
      } catch {
        // Offline: the local cache still has the note.
      }
    }
  },

  /** Clears only local caches; the session is ended by authService.logout(). */
  clear(): void {
    if (typeof localStorage === 'undefined') return;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(USER_NOTES_STORAGE_PREFIX)) localStorage.removeItem(key);
      if (key.startsWith(SUMMARY_STORAGE_PREFIX)) localStorage.removeItem(key);
      if (key.startsWith(MEMORY_LANGUAGE_STORAGE_PREFIX)) localStorage.removeItem(key);
      if (key.startsWith(MEMORY_TRANSLATION_STORAGE_PREFIX)) localStorage.removeItem(key);
    }
    localStorage.removeItem('agakai_mock_session');
  },
};
