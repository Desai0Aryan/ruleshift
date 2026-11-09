-- Creator mode: player-made puzzles. Only ROOT nodes (parent_id is null) of a custom chain carry the definition
-- (a small JSON of integers, validated by the engine in the Edge Function; no text). Children reach it via their parent.
alter table public.nodes add column if not exists custom jsonb;
alter table public.nodes add constraint nodes_custom_root_only check (custom is null or parent_id is null);
