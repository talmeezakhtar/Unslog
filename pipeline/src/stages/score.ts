import { NoProviderAvailable, type AiRouter } from '../ai/index.js';
import { ScoreSchema, scoringPrompt } from '../ai/prompts.js';
import type { Repo } from '../db/repo.js';
import { errorMessage, log } from '../lib/log.js';
import type { Profile } from '../types.js';

/**
 * Scores the best pre-filtered jobs with AI, up to the user's daily cap. When AI is not
 * configured or runs out, jobs still get a score: the free quick score, marked 'heuristic'.
 */
export async function scoreJobs(repo: Repo, ai: AiRouter, profile: Profile, opts: { heuristicLimit?: number } = {}): Promise<{ ai: number; heuristic: number }> {
  const already = await repo.aiScoredToday(profile.userId);
  const aiBudget = Math.max(0, profile.maxAiJobsPerDay - already);
  const candidates = await repo.toScore(profile.userId, aiBudget + (opts.heuristicLimit ?? 200));
  let aiCount = 0;
  let heuristic = 0;
  let aiUsable = ai.hasProviders && aiBudget > 0;

  for (const job of candidates) {
    if (aiUsable && aiCount < aiBudget) {
      try {
        const { data, model } = await ai.json('score', scoringPrompt(profile, job), ScoreSchema);
        await repo.saveScore(job.matchId, {
          score: data.score,
          reasons: data.reasons,
          missingSkills: data.missing_skills,
          visaNote: data.visa_note ?? null,
          model,
        });
        aiCount++;
        continue;
      } catch (err) {
        if (err instanceof NoProviderAvailable) {
          log.warn('AI unavailable, using heuristic scores for the rest', { reason: err.message.slice(0, 200) });
          aiUsable = false;
        } else {
          log.warn('scoring failed for one job, using heuristic', { job: job.id, error: errorMessage(err) });
        }
      }
    }
    if (job.hasHeuristic) continue; // already has its heuristic score from an earlier day
    await repo.saveScore(job.matchId, {
      score: job.quickScore,
      reasons: ['Quick score from skill overlap, title and freshness (no AI used)'],
      missingSkills: [],
      visaNote: job.visaFlags.includes('residents_only') ? 'Posting asks for UAE residents' : null,
      model: 'heuristic',
    });
    heuristic++;
  }
  return { ai: aiCount, heuristic };
}
