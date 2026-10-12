-- toScore() (pipeline/src/db/repo.ts) orders unscored matches by quick_score for a given user,
-- but job_matches_user_score_idx only covers the AI `score` column, not `quick_score`. This
-- partial index covers the common case (brand new matches, scored_at is null).
create index job_matches_toscore_idx on job_matches (user_id, quick_score desc nulls last)
  where prefilter_passed and dismissed_at is null and scored_at is null;
