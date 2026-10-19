import { appConfig, isBackendConfigured } from '@/services/appConfig';
import { getSupabase } from '@/services/supabase';
import { mockBenefits } from '@/data/mock';
import { benefitFromJson, type Benefit } from '@/models/benefit';

const BENEFITS_CACHE_TTL_MS = 5 * 60_000;
let benefitsCache: Benefit[] | null = null;
let benefitsCachedAt = 0;
let benefitsRequest: Promise<Benefit[]> | null = null;

const STOP_WORDS = new Set([
  'the', 'and', 'barangay', 'brgy', 'city', 'province', 'philippines',
  'street', 'st', 'zone', 'purok', 'sitio', 'village', 'road', 'blvd',
]);

/** Pulls candidate place names out of an address (>= 3 letters, minus common words). */
function addressTokens(address: string): Set<string> {
  const cleaned = address
    .toLowerCase()
    .replace(/\bbrgy\.?\b/g, ' ')
    .replace(/[.,;-]/g, ' ');
  return new Set(
    cleaned
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t)),
  );
}

/** Is a single benefit relevant to the senior at `address`? */
export function isRelevantFor(benefit: Benefit, address?: string | null): boolean {
  const tokens = addressTokens(address ?? '');
  if (tokens.size === 0) return true;
  const lgu = benefit.lgu.toLowerCase();
  if (lgu.startsWith('national') || lgu.includes('all lgu')) return true;
  return [...tokens].some((t) => lgu.includes(t));
}

/**
 * Retrieval service for the `benefit` table.
 * Fetches from Supabase when configured, with mockBenefits fallback.
 */
function refreshBenefits(): Promise<Benefit[]> {
  if (benefitsRequest) return benefitsRequest;
  benefitsRequest = (async () => {
    if (isBackendConfigured()) {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('benefit')
          .select('*')
          .order('title', { ascending: true });

        if (!error && data && data.length > 0) {
          benefitsCache = data.map(benefitFromJson);
          benefitsCachedAt = Date.now();
          return benefitsCache;
        }
      } catch {
        // Keep using the last good cache or mock fallback.
      }
    }

    if (benefitsCache) {
      benefitsCachedAt = Date.now();
      return benefitsCache;
    }
    benefitsCache = appConfig.useMockData ? mockBenefits : [];
    benefitsCachedAt = Date.now();
    return benefitsCache;
  })().finally(() => { benefitsRequest = null; });
  return benefitsRequest;
}

export const benefitService = {
  async loadBenefits(): Promise<Benefit[]> {
    if (benefitsCache) {
      if (Date.now() - benefitsCachedAt >= BENEFITS_CACHE_TTL_MS) void refreshBenefits();
      return benefitsCache;
    }
    return refreshBenefits();
  },

  /** Falls back to the full list so the screen is never empty. */
  async loadRelevantBenefits(address?: string | null): Promise<Benefit[]> {
    const all = await this.loadBenefits();
    if (!(address ?? '').trim()) return all;
    const relevant = all.filter((b) => isRelevantFor(b, address));
    return relevant.length === 0 ? all : relevant;
  },
};
