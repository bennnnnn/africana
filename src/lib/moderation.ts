/**
 * Minimal client-side content filter. Catches the most common slurs and
 * obvious sexual solicitations so Apple / Google reviewers see the app
 * actively moderating user-generated content.
 *
 * This is intentionally a small, maintainable list — not a heavy ML model.
 * Server-side / report-based moderation is the real safety net; this filter
 * just blocks the low-effort worst offenders at send time.
 *
 * To add more patterns, keep them lowercase and consider how they appear in
 * real messages (word-boundary regex already handles case-insensitivity).
 */

// Hateful slurs. Add more as needed; kept small & generic here.
const SLUR_PATTERNS: RegExp[] = [
  /\bn[i1l!][g9]+(er|a|ah|ga)s?\b/i,
  /\bf[a@][g9]+(ot|gy|s)?\b/i,
  /\bt[r]?ann(y|ies)\b/i,
  /\bch[i1l!]nk(s|y)?\b/i,
  /\bk[i1!]ke(s)?\b/i,
  /\bsp[i1!]c(s|k|ks)?\b/i,
  /\bwetb[a@]ck(s)?\b/i,
  /\bretard(s|ed)?\b/i,
];

// Obvious sexual solicitation / CSAM red flags. Very conservative — false
// positives here are fine since users can rephrase.
const SOLICITATION_PATTERNS: RegExp[] = [
  /\bunder[\s-]?age\b/i,
  /\b(?:12|13|14|15|16|17)\s*(?:yo|y\/o|year\s*old)\b/i,
  /\bsend\s+(?:me\s+)?(?:nudes?|pics?|dick|pussy)\b/i,
  /\bonlyfans?\b.*\blink\b/i,
  /\bsugar\s*dadd[yi]\b.*\bpay\b/i,
];

const ALL_PATTERNS: RegExp[] = [...SLUR_PATTERNS, ...SOLICITATION_PATTERNS];

export type ModerationResult =
  | { ok: true }
  | { ok: false; reason: 'slur' | 'solicitation' };

export function moderateMessage(text: string): ModerationResult {
  if (!text) return { ok: true };
  const trimmed = text.trim();
  if (!trimmed) return { ok: true };

  for (const pattern of SLUR_PATTERNS) {
    if (pattern.test(trimmed)) return { ok: false, reason: 'slur' };
  }
  for (const pattern of SOLICITATION_PATTERNS) {
    if (pattern.test(trimmed)) return { ok: false, reason: 'solicitation' };
  }
  return { ok: true };
}

/** For test / diagnostics only — not used at runtime. */
export function _moderationPatternCount(): number {
  return ALL_PATTERNS.length;
}
