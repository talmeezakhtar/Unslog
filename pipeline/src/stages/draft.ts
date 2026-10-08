import { NoProviderAvailable, type AiRouter } from '../ai/index.js';
import { coverNotePrompt, followUpPrompt, outreachPrompt } from '../ai/prompts.js';
import type { Repo } from '../db/repo.js';
import { errorMessage, log } from '../lib/log.js';
import { truncate } from '../lib/text.js';
import type { JobForMatching, Profile } from '../types.js';

/** Fill-in-the-blanks drafts used when no AI is available, so the user always gets something to edit. */
export function templateCoverNote(p: Profile, j: JobForMatching): string {
  const mine = new Set(p.skills.map((s) => s.toLowerCase()));
  const shared = j.skills.filter((s) => mine.has(s.toLowerCase())).slice(0, 3);
  const skills = shared.length ? shared.join(', ') : p.skills.slice(0, 3).join(', ') || 'software development';
  return [
    `Hello ${j.company ? `${j.company} ` : ''}hiring team,`,
    '',
    `I'd like to apply for the ${j.title} role${j.city ? ` in ${j.city}` : ''}. I work with ${skills}` +
      `${p.yearsExperience ? ` and have ${p.yearsExperience} year${p.yearsExperience === 1 ? '' : 's'} of experience` : ''}.` +
      `${p.highlightProject ? ` Recently I built ${p.highlightProject}.` : ''}`,
    '',
    'I would welcome a short call to discuss how I can help your team.',
    '',
    p.fullName ?? '',
  ]
    .join('\n')
    .trim();
}

export function templateOutreach(p: Profile, j: JobForMatching): string {
  const skills = p.skills.slice(0, 2).join(' and ') || 'software development';
  return truncate(
    `Hi [Name], I saw the ${j.title} opening at ${j.company ?? 'your company'} and applied. I work with ${skills}` +
      `${p.highlightProject ? ` and recently built ${p.highlightProject}` : ''}. Would love to connect and learn about the team.`,
    300,
  );
}

export function templateFollowUp(p: Profile, job: { title: string; company: string | null }): string {
  return [
    'Hello,',
    '',
    `I applied for the ${job.title} role${job.company ? ` at ${job.company}` : ''} recently and wanted to follow up. ` +
      "I'm still very interested and happy to share more about my experience or join a short call at your convenience.",
    '',
    'Thank you,',
    p.fullName ?? '',
  ]
    .join('\n')
    .trim();
}

async function aiOrTemplate(ai: AiRouter, enabled: { value: boolean }, prompt: Parameters<AiRouter['text']>[1], fallback: string): Promise<{ text: string; model: string }> {
  if (enabled.value) {
    try {
      const { data, model } = await ai.text('draft', prompt);
      return { text: data, model };
    } catch (err) {
      if (err instanceof NoProviderAvailable) enabled.value = false;
      log.warn('draft failed, using template', { error: errorMessage(err).slice(0, 200) });
    }
  }
  return { text: fallback, model: 'template' };
}

/** Cover note + outreach note for the top jobs, and follow-up drafts for applications that went quiet. */
export async function writeDrafts(repo: Repo, ai: AiRouter, profile: Profile, topN: number): Promise<{ jobs: number; followUps: number }> {
  const enabled = { value: ai.hasProviders };
  const jobs = await repo.toDraft(profile.userId, profile.minScore, topN);
  for (const job of jobs) {
    const cover = await aiOrTemplate(ai, enabled, coverNotePrompt(profile, job), templateCoverNote(profile, job));
    await repo.saveDraft(profile.userId, job.id, 'cover_note', cover.text, cover.model);
    const note = await aiOrTemplate(ai, enabled, outreachPrompt(profile, job), templateOutreach(profile, job));
    await repo.saveDraft(profile.userId, job.id, 'outreach', truncate(note.text, 300), note.model);
  }

  const due = await repo.followUpsWithoutDraft(profile.userId);
  for (const f of due) {
    const days = f.appliedAt ? Math.round((Date.now() - new Date(f.appliedAt).getTime()) / 86_400_000) : profile.followUpDays;
    const msg = await aiOrTemplate(ai, enabled, followUpPrompt(profile, f, days), templateFollowUp(profile, f));
    await repo.saveDraft(profile.userId, f.jobId, 'follow_up', msg.text, msg.model);
  }
  return { jobs: jobs.length, followUps: due.length };
}
