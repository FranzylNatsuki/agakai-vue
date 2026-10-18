import { appConfig, isBackendConfigured } from '@/services/appConfig';
import { getSupabase } from '@/services/supabase';
import { mockProfile, mockUserNotes } from '@/data/mock';
import { profileFromJson, type Profile } from '@/models/profile';

const USER_ID_STORAGE_KEY = 'agakai_current_user_id';
const USER_NOTES_STORAGE_PREFIX = 'agakai_user_notes_';

function readStoredUserId(): number | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(USER_ID_STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

let currentUserId: number | null = readStoredUserId();
const notesListeners = new Set<(notes: string) => void>();

function notifyNotesListeners(notes: string) {
  for (const cb of notesListeners) {
    cb(notes);
  }
}

function localNotesKey(userId: number | null): string {
  return `${USER_NOTES_STORAGE_PREFIX}${userId ?? 'anon'}`;
}

export const profileService = {
  /** Called right after a successful login with the `user` row id. */
  setCurrentUser(userId: number): void {
    currentUserId = userId;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USER_ID_STORAGE_KEY, String(userId));
    }
  },

  get currentUserId(): number | null {
    return currentUserId;
  },

  get hasCurrentUser(): boolean {
    return currentUserId !== null;
  },

  /** Subscribe to live updates whenever `user_notes` changes. */
  onNotesChange(cb: (notes: string) => void): () => void {
    notesListeners.add(cb);
    return () => {
      notesListeners.delete(cb);
    };
  },

  /** Loads senior citizen record from Supabase `user` table. */
  async loadProfile(): Promise<Profile> {
    if (isBackendConfigured() && currentUserId !== null) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('id', currentUserId)
        .single();

      if (!error && data) {
        return profileFromJson(data);
      }
    }

    if (appConfig.useMockData || currentUserId !== null) {
      return mockProfile;
    }

    throw new Error('Please sign in to view your profile.');
  },

  async loadProfileOrNull(): Promise<Profile | null> {
    try {
      return await this.loadProfile();
    } catch {
      return null;
    }
  },

  /**
   * Loads rolling `user_notes` directly from Supabase `user` table.
   * Returns `""` when the user has no memory yet.
   */
  async loadUserNotes(): Promise<string | null> {
    if (isBackendConfigured() && currentUserId !== null) {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('user')
          .select('user_notes')
          .eq('id', currentUserId)
          .maybeSingle();

        if (!error && data) {
          const notes = (data.user_notes ?? '').trim();
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(localNotesKey(currentUserId), notes);
          }
          return notes;
        }
      } catch {
        // Fall through to localStorage fallback
      }
    }

    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(localNotesKey(currentUserId));
      if (saved !== null) return saved;
    }

    if (appConfig.useMockData) {
      return mockUserNotes;
    }

    return '';
  },

  /** Persists updated rolling support notes to Supabase `user` table and notifies UI. */
  async saveUserNotes(notes: string): Promise<void> {
    const clean = notes.trim();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(localNotesKey(currentUserId), clean);
    }
    notifyNotesListeners(clean);

    if (isBackendConfigured() && currentUserId !== null) {
      try {
        const supabase = getSupabase();
        await supabase
          .from('user')
          .update({ user_notes: clean })
          .eq('id', currentUserId);
      } catch {
        // Ignore network error if offline
      }
    }
  },

  /** Clear current user (e.g. on log out). */
  clear(): void {
    currentUserId = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(USER_ID_STORAGE_KEY);
    }
  },
};
