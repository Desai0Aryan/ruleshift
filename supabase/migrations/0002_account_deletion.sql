-- Account deletion (App Store requirement for apps that create accounts, even anonymous ones).
-- Problem with 0001: nodes.player_id was "on delete cascade", and nodes.parent_id cascades too, so deleting
-- one player would also delete every branch other people built on top of their puzzles.
-- Fix: keep the puzzle (it contains only physics moves, no personal data) but detach it from the player.
alter table public.nodes alter column player_id drop not null;
alter table public.nodes drop constraint if exists nodes_player_id_fkey;
alter table public.nodes
  add constraint nodes_player_id_fkey foreign key (player_id) references auth.users(id) on delete set null;
-- events (share/copy/solve counters) are per-user and are removed with the user (already "on delete cascade").
