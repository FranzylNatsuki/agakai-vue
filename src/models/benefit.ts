export interface BenefitTranslation {
  title?: string;
  description?: string;
  dateAndLocation?: string;
  lgu?: string;
}

export interface Benefit {
  id: string;
  title: string;
  /** Combined "Jan 15, 2026 • Lapu-Lapu City" display string. */
  dateAndLocation: string;
  iconKey: string;
  category: string;
  description: string;
  /** LGU(s) the benefit applies to, used for location filtering. */
  lgu: string;
  /** Optional locale-code translations, e.g. { ceb: { title, description } }. */
  translations?: Record<string, BenefitTranslation>;
}

/** Replace database shorthand with a clear, locale-appropriate coverage label. */
const NATIONWIDE_LABELS: Record<string, string> = {
  en: 'Available nationwide',
  ceb: 'Sakop sa tibuok nasod',
  tl: 'Sakop sa buong bansa',
};

function isNationwideLabel(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return /^(?:national\s*\/\s*all\s+lgus?|all\s+lgus?|nationwide|nation[- ]wide|all\s+(?:of\s+)?(?:the\s+)?philippines|philippines[- ]wide|available nationwide|sa tibuok nasod|sa buong bansa|sakop sa tibuok nasod|sakop sa buong bansa|nasodnon\s*\/\s*tanang\s+lgus?|pambansa\s*\/\s*lahat ng\s+lgus?)$/i.test(normalized);
}

function localizeCoverage(value: string, localeCode: string): string {
  return isNationwideLabel(value) ? NATIONWIDE_LABELS[localeCode] ?? NATIONWIDE_LABELS.en : value;
}

function localizeDateAndLocation(value: string, localeCode: string): string {
  const parts = value.split('•').map((part) => part.trim());
  if (parts.length > 1) {
    const location = parts.slice(1).join(' • ');
    const localizedLocation = localizeCoverage(location, localeCode);
    return [parts[0], localizedLocation].filter(Boolean).join(' • ');
  }
  return localizeCoverage(value, localeCode);
}

/** Resolve optional benefit copy by locale code, falling back to the source text. */
export function localizeBenefit(benefit: Benefit, localeCode: string): Benefit {
  const translation = benefit.translations?.[localeCode];
  const dateAndLocation = translation?.dateAndLocation || benefit.dateAndLocation;
  const lgu = translation?.lgu || benefit.lgu;
  return {
    ...benefit,
    title: translation?.title || benefit.title,
    description: translation?.description || benefit.description,
    dateAndLocation: localizeDateAndLocation(dateAndLocation, localeCode),
    lgu: localizeCoverage(lgu, localeCode),
  };
}

/** Ionicons name for a benefit's `iconKey` (mirrors Benefit.iconData in Flutter). */
export type BenefitIconName = 'cash' | 'medkit' | 'restaurant' | 'bus' | 'card';

export function benefitIconName(iconKey: string): BenefitIconName {
  switch (iconKey.toLowerCase()) {
    case 'pension':
    case 'cash':
    case 'money':
      return 'cash';
    case 'medical':
    case 'hospital':
    case 'health':
      return 'medkit';
    case 'food':
    case 'grocery':
      return 'restaurant';
    case 'transport':
    case 'bus':
    case 'fare':
      return 'bus';
    default:
      return 'card';
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-01-15" → "Jan 15, 2026". Returns the raw string if unparseable. */
export function formatBenefitDate(raw: string): string {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return `${MONTHS[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
}

/** Parses either a local asset row or a Supabase `benefit` row. */
export function benefitFromJson(json: Record<string, any>): Benefit {
  const date = formatBenefitDate(json.date ?? '');
  const location: string = json.location ?? json.lgu ?? '';

  let combined: string = json.dateAndLocation ?? '';
  if (!combined && (date || location)) {
    combined = [date, location].filter(Boolean).join(' • ');
  }

  return {
    id: json.id ?? '',
    title: json.title ?? '',
    dateAndLocation: combined,
    iconKey: json.iconKey ?? json.iconkey ?? '',
    category: json.category ?? '',
    description: json.description ?? json.simplified_description ?? '',
    lgu: json.lgu ?? '',
    translations:
      json.translations && typeof json.translations === 'object' && !Array.isArray(json.translations)
        ? json.translations
        : undefined,
  };
}
