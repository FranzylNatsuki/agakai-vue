import { appConfig, isBackendConfigured } from '@/services/appConfig';
import { getSupabase } from '@/services/supabase';
import { mockProfile, mockUserNotes } from '@/data/mock';
import { profileFromJson, type Profile } from '@/models/profile';

const USER_ID_STORAGE_KEY = 'agakai_current_user_id';
const USER_NOTES_STORAGE_KEY = 'agakai_user_notes';

function readStoredUserId(): number | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(USER_ID_STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

let currentUserId: number | null = readStoredUserId();

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

  /** Loads rolling user_notes from Supabase (or localStorage fallback). */
  async loadUserNotes(): Promise<string | null> {
    if (isBackendConfigured() && currentUserId !== null) {
      try {
        const supabase = getSupabase();
        const { data } = await supabase
          .from('user')
          .select('user_notes')
          .eq('id', currentUserId)
          .maybeSingle();

        if (data?.user_notes !== undefined && data.user_notes !== null) {
          return data.user_notes;
        }
      } catch {
        // Fall back to local storage
      }
    }

    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(USER_NOTES_STORAGE_KEY);
      if (saved !== null) return saved;
    }

    return mockUserNotes;
  },

  /** Persists updated rolling support notes to Supabase and localStorage. */
  async saveUserNotes(notes: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USER_NOTES_STORAGE_KEY, notes);
    }

    if (isBackendConfigured() && currentUserId !== null) {
      try {
        const supabase = getSupabase();
        await supabase
          .from('user')
          .update({ user_notes: notes, updated_at: new Date().toISOString() })
          .eq('id', currentUserId);
      } catch {
        // Non-critical background save
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
