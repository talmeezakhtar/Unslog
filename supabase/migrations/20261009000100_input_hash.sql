-- Lets the pipeline tell whether a profile edit (skills, CV, highlight project...) invalidates
-- an existing AI score or draft, instead of treating "already scored/drafted" as permanent.
alter table job_matches add column input_hash text;
alter table drafts add column input_hash text;
