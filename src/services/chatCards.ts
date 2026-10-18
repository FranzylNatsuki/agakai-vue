export type SupplementalCardKind = 'map' | 'benefits';
export type ConversationTurn = { role: 'user' | 'model'; text: string };

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function directCardKind(text: string): SupplementalCardKind | null {
  const lower = normalize(text);
  const benefitIntent =
    /\b(?:benefit|benefits|benepisyo|pensyon|pension|allowance|discount|discounts|cash aid|cash assistance|financial (?:help|assistance)|tulong pinansyal|tabang pinansyal|ayuda)\b/.test(lower)
    || (/\b(?:support|assistance|help|aid|programs?|services?|tulong|tabang)\b/.test(lower)
      && /\b(?:senior|seniors|senior citizen|lola|lolo|elderly|tigulang|nakatatanda)\b/.test(lower));
  if (benefitIntent) return 'benefits';

  const carePlace =
    /\b(?:doctor|doctors|clinic|clinics|hospital|hospitals|health center|health centre|medical center|medical centre|barangay health station|botika|pharmacy|doktor|ospital|klinika)\b/.test(lower);
  const asksForCareLocation = carePlace
    && /\b(?:where|nearest|near me|find|look for|locate|map|directions|go to|visit|need to see|want to see|can i see|asa|saan|adto|moadto|mangita|pangita|makakita|makaadto)\b/.test(lower);
  const asksForCheckup = /(?:check[ -]?ups?|pacheckup|magpacheckup|treatment)/.test(lower)
    && /\b(?:need|want|book|schedule|get|where|asa|saan|mangita|pangita)\b/.test(lower);
  const asksWhereToGoWithHealthIssue =
    /\b(?:sick|ill|fever|pain|injured|hurt|symptom|sakit|hilanaat|hilanat)\b/.test(lower)
    && /\b(?:where|where should i go|asa|saan|adto|moadto|makaadto)\b/.test(lower);

  return asksForCareLocation || asksForCheckup || asksWhereToGoWithHealthIssue ? 'map' : null;
}

function isConversationalFollowUp(question: string): boolean {
  const lower = normalize(question).trim();
  return /^(?:and what about|what about|how about|where is it|where is that|where\??|how much|how do i do that|can i do that|can i get it|is it available|is that available|am i eligible|tell me more|more|yes|no|okay|please|there|that|it|those|them)(?:[.!?, ]|$)/.test(lower);
}

/**
 * Selects a relevant card from natural spoken or typed intent, not FAQ wording.
 * Short follow-ups may inherit the intent of the immediately preceding user turn.
 */
export function supplementalCardKind(
  question: string,
  history: ConversationTurn[] = [],
): SupplementalCardKind | null {
  const direct = directCardKind(question);
  if (direct) return direct;
  if (!isConversationalFollowUp(question)) return null;

  const previousUserTurn = [...history].reverse().find((turn) => turn.role === 'user');
  return previousUserTurn ? directCardKind(previousUserTurn.text) : null;
}
