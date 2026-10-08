import { containsTerm } from '../lib/text.js';

/** A row of the skills dictionary (supabase/migrations/..._skills.sql). */
export interface Skill {
  id: number;
  name: string;
  aliases: string[];
}

/**
 * Skills mentioned in the text, matched as whole words on the aliases (or the name when a skill
 * has no aliases). Aliases exist so short names like "Go" can be matched safely as "golang".
 */
export function extractSkills(text: string, dictionary: Skill[]): Skill[] {
  const hay = text.toLowerCase();
  return dictionary.filter((s) => (s.aliases.length ? s.aliases : [s.name.toLowerCase()]).some((term) => containsTerm(hay, term)));
}

/**
 * Visa phrases that matter a lot on a visit visa. Returned as flags stored on the job:
 *  - residents_only: the employer only wants people already holding a UAE residence visa
 *  - visit_visa_ok:  the posting says visit-visa holders can apply
 *  - sponsorship:    the employer provides the visa
 */
export function visaFlags(text: string): string[] {
  const t = text.toLowerCase();
  const flags: string[] = [];
  if (
    /(uae|u\.a\.e\.?)\s+residents?\s+only|only\s+(uae\s+)?residents|must\s+(be|have)\s+(a\s+)?(uae\s+)?resident|residence visa (is )?(required|mandatory)|own (residence )?visa (required|mandatory)|candidates? (currently )?(residing|based) in (the )?uae only|transferable visa/.test(t)
  )
    flags.push('residents_only');
  if (/visit visa( holders?)? (can|may|are welcome|accepted|ok)|visit visa (candidates|applicants)|on visit visa/.test(t))
    flags.push('visit_visa_ok');
  if (/visa (will be )?(provided|sponsored|sponsorship)|visa sponsorship|company (provides|will provide) visa|employment visa provided/.test(t))
    flags.push('sponsorship');
  return flags;
}

/** Minimum years of experience asked for ("3+ years", "2-4 years", "minimum 5 years"), or null. */
export function experienceMin(text: string): number | null {
  const t = text.toLowerCase();
  const patterns = [
    /(?:minimum|min\.?|at least|over)\s+(?:of\s+)?(\d{1,2})\s*\+?\s*(?:years?|yrs?)/,
    /(\d{1,2})\s*(?:\+|plus)\s*(?:years?|yrs?)/,
    /(\d{1,2})\s*(?:-|–|to)\s*\d{1,2}\s*(?:years?|yrs?)/,
    /(\d{1,2})\s*(?:years?|yrs?)(?:'|’)?\s*(?:of\s+)?(?:relevant\s+|professional\s+|hands[- ]on\s+|work\s+)?experience/,
  ];
  let best: number | null = null;
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (n <= 25) best = best === null ? n : Math.min(best, n);
    }
  }
  return best;
}

/**
 * Monthly AED salary range from free text: "AED 8,000 - 12,000 per month", "AED 180k per year",
 * "8000-10000 AED". Yearly figures are divided by 12. Returns nulls when unsure.
 */
export function parseSalary(text: string | null | undefined): { min: number | null; max: number | null } {
  const none = { min: null, max: null };
  if (!text) return none;
  const t = text.toLowerCase().replace(/(\d),(\d)/g, '$1$2');
  const cur = '(?:aed|dhs?|dirhams?)';
  const num = '(\\d+(?:\\.\\d+)?)\\s*(k)?';
  // A currency word right before or after a number or a range of numbers.
  const re = new RegExp(
    `${cur}\\.?\\s*${num}(?:\\s*(?:-|–|to)\\s*(?:${cur}\\.?\\s*)?${num})?|${num}(?:\\s*(?:-|–|to)\\s*${num})?\\s*${cur}\\b`,
  );
  const m = t.match(re);
  if (!m) return none;
  const pick = (v?: string, k?: string) => (v ? Number(v) * (k ? 1000 : 1) : null);
  const values = [pick(m[1], m[2]), pick(m[3], m[4]), pick(m[5], m[6]), pick(m[7], m[8])].filter(
    (n): n is number => n !== null && n >= 1000 && n <= 2_000_000,
  );
  if (values.length === 0) return none;
  // Look just after the amount for the period ("per year", "a month", "/yr").
  const after = t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 30);
  const monthly = /^\W*(per month|a month|monthly|\/ ?(month|mo)\b|pm\b|p\.m\.)/.test(after);
  const yearly = !monthly && (/^\W*(per (year|annum)|a year|yearly|annual(ly)?|\/ ?(year|yr)\b|pa\b|p\.a\.)/.test(after) || Math.min(...values) > 100_000);
  const toMonthly = (n: number) => Math.round(yearly ? n / 12 : n);
  const min = toMonthly(Math.min(...values));
  const max = values.length > 1 ? toMonthly(Math.max(...values)) : null;
  return { min, max };
}
