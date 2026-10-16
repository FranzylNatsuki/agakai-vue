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
  };
}
