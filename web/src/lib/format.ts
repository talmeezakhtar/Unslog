const DAY = 86_400_000;

/** Only http(s) links are rendered, so a stored "javascript:" URL can never run. */
export function safeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** "today", "yesterday", "3 days ago", or a short date for anything older than two weeks. */
export function ago(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso);
  const days = Math.floor((startOfDay(new Date()).getTime() - startOfDay(then).getTime()) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function greeting(name: string | null | undefined): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

export const VISA_LABEL: Record<string, string> = {
  residents_only: 'UAE residents only',
  visit_visa_ok: 'Visit visa OK',
  sponsorship: 'Visa provided',
};

export function sourceNames(sightings: Array<{ source: { name: string } | null }>): string[] {
  return [...new Set(sightings.map((s) => (s.source?.name ?? '').replace(/ \(.*\)$/, '')).filter(Boolean))];
}

export function modelLabel(model: string | null): string {
  if (!model) return '';
  if (model === 'heuristic') return 'Quick score (no AI)';
  if (model === 'template') return 'Template';
  // Stored as "provider/model@prompt-version"; show just the model name.
  return model.split('/').pop()?.split('@')[0] || model;
}
