/** UAE location helpers: map messy location strings to a canonical emirate/city. */

// Arabic has no word characters in JS's \b sense, so Arabic alternatives are matched as plain
// substrings (no \b) alongside the \b-wrapped Latin ones.
const CITY_PATTERNS: Array<[string, RegExp]> = [
  ['Dubai', /\b(dubai|jebel ali|deira|bur dubai|jlt|jumeirah|dubai internet city|dubai media city|business bay|al quoz|difc|dso|silicon oasis|dubai south)\b|دبي/i],
  ['Abu Dhabi', /\b(abu ?dhabi|musaffah|mussafah|al reem|khalifa city|masdar)\b|أبوظبي|ابوظبي|أبو ظبي|ابو ظبي/i],
  ['Sharjah', /\b(sharjah|saif zone)\b|الشارقة/i],
  ['Ajman', /\bajman\b|عجمان/i],
  ['Ras Al Khaimah', /\b(ras al[- ]?khaimah|rak)\b|رأس الخيمة|راس الخيمة/i],
  ['Fujairah', /\bfujairah\b|الفجيرة/i],
  ['Umm Al Quwain', /\bumm al[- ]?quwain\b|أم القيوين|ام القيوين/i],
  ['Al Ain', /\bal ain\b|العين/i],
];

const UAE_PATTERN = /\b(uae|u\.a\.e\.?|united arab emirates|emirates)\b|الإمارات|الامارات/i;

/** Returns the canonical city, or null when the string names no known UAE place. */
export function detectCity(location: string | null | undefined): string | null {
  if (!location) return null;
  for (const [city, re] of CITY_PATTERNS) if (re.test(location)) return city;
  return null;
}

/** True when a location string is in the UAE (a known city, or the country itself). */
export function isUae(location: string | null | undefined): boolean {
  if (!location) return false;
  return detectCity(location) !== null || UAE_PATTERN.test(location);
}

export const UAE_CITIES = CITY_PATTERNS.map(([city]) => city);
