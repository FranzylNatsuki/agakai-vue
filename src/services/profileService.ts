import { appConfig } from '@/services/appConfig';
import { mockProfile, mockUserNotes } from '@/data/mock';
import type { Profile } from '@/models/profile';

/**
 * Loads the logged-in senior's record from the `user` table.
 * TODO(backend): all methods are intentionally blank placeholders.
 */
let currentUserId: number | null = null;

export const profileService = {
  /** Called right after a successful login with the `user` row id. */
  setCurrentUser(userId: number): void {
    currentUserId = userId;
  },

  get hasCurrentUser(): boolean {
    return currentUserId !== null || appConfig.useMockData;
  },

  /** TODO(backend): select * from `user` where id = currentUserId. */
  async loadProfile(): Promise<Profile> {
    if (appConfig.useMockData) return mockProfile;
    throw new Error('Profile service not implemented yet.');
  },

  async loadProfileOrNull(): Promise<Profile | null> {
    try {
      return await this.loadProfile();
    } catch {
      return null;
    }
  },

  /** TODO(backend): select user_notes from `user`. Return null on failure. */
  async loadUserNotes(): Promise<string | null> {
    if (appConfig.useMockData) return mockUserNotes;
    return null;
  },

  /** Clear current user (e.g. on log out). */
  clear(): void {
    currentUserId = null;
  },
};
