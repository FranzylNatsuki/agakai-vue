import { appConfig, isBackendConfigured } from '@/services/appConfig';
import { getSupabase } from '@/services/supabase';

/**
 * Seniors sign in with their Senior ID and a 6-digit PIN.
 * Supabase Auth stores the PIN; the app only ever holds the session.
 * The synthetic address is internal and never shown to the senior.
 */
export const SENIOR_EMAIL_DOMAIN = 'seniors.agakai.local';
const MOCK_SESSION_KEY = 'agakai_mock_session';

export function normalizeSeniorId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function seniorEmail(seniorId: string): string {
  return `${normalizeSeniorId(seniorId)}@${SENIOR_EMAIL_DOMAIN}`;
}

export function isPinValid(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

function mockSession(): boolean {
  return appConfig.useMockData && typeof localStorage !== 'undefined'
    && localStorage.getItem(MOCK_SESSION_KEY) === '1';
}

export const authService = {
  async login(seniorId: string, pin: string): Promise<{ id: string }> {
    const id = normalizeSeniorId(seniorId);
    if (!id) throw new Error('Please enter your Senior ID.');
    if (!pin) throw new Error('Please enter your PIN.');

    if (!isBackendConfigured()) {
      if (appConfig.useMockData) {
        localStorage.setItem(MOCK_SESSION_KEY, '1');
        return { id: 'mock-senior' };
      }
      throw new Error(
        'Backend is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env, or enable VITE_USE_MOCK_DATA=true.',
      );
    }

    if (!isPinValid(pin)) throw new Error('Your PIN is 6 numbers.');

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: seniorEmail(id),
      password: pin,
    });
    // One message for both unknown IDs and wrong PINs: no account enumeration.
    if (error || !data.user) {
      throw new Error('Check your Senior ID and PIN, then try again.');
    }
    return { id: data.user.id };
  },

  /** The signed-in auth user id, or null. Never trusts local storage alone. */
  async currentUserId(): Promise<string | null> {
    if (!isBackendConfigured()) return mockSession() ? 'mock-senior' : null;
    const { data } = await getSupabase().auth.getSession();
    return data.session?.user.id ?? null;
  },

  async hasSession(): Promise<boolean> {
    return (await this.currentUserId()) !== null;
  },

  async logout(): Promise<void> {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(MOCK_SESSION_KEY);
    if (isBackendConfigured()) await getSupabase().auth.signOut();
  },
};
