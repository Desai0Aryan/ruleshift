-- RULESHIFT backend schema (Phase 2). Apply with `supabase db push` or paste into the SQL editor.
-- Security model: clients never touch these tables. All reads/writes go through the `api` Edge Function
-- (service role), which re-simulates every published puzzle with the shared deterministic engine.
-- Row Level Security is ON with no policies => anon/authenticated roles are denied everything.

create table if not exists public.nodes (
  id          text primary key,
  parent_id   text references public.nodes(id) on delete cascade,
  depth       int  not null check (depth between 1 and 40),
  base        text not null,
  rule        text not null,
  seed        bigint not null,
  solved      jsonb not null,   -- player's solution to the puzzle BEFORE this twist
  proof       jsonb not null,   -- solution to the puzzle AFTER the twist (private: it's the answer)
  player_id   uuid not null references auth.users(id) on delete cascade,
  engine      int  not null,
  created_at  timestamptz not null default now()
);
create index if not exists nodes_parent_idx on public.nodes(parent_id);
create index if not exists nodes_player_idx on public.nodes(player_id, created_at desc);

create table if not exists public.events (
  id         bigserial primary key,
  node_id    text not null references public.nodes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('open','solve','share','copy')),
  created_at timestamptz not null default now()
);
create index if not exists events_node_idx on public.events(node_id, kind);
create index if not exists events_day_idx on public.events(created_at);

create table if not exists public.banned_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason  text,
  created_at timestamptz not null default now()
);

alter table public.nodes        enable row level security;
alter table public.events       enable row level security;
alter table public.banned_users enable row level security;

-- ===== Phase-2 gate metrics (query these in the Supabase SQL editor) =====
-- Send rate = share events per solve event, per day. Goal from PLAN.md: "do people actually send challenges?"
create or replace view public.gate_daily as
select
  date_trunc('day', created_at)::date                                   as day,
  count(*) filter (where kind = 'open')                                 as opens,
  count(*) filter (where kind = 'solve')                                as solves,
  count(*) filter (where kind = 'share')                                as shares,
  round(count(*) filter (where kind = 'share')::numeric
        / nullif(count(*) filter (where kind = 'solve'), 0), 3)         as shares_per_solve
from public.events group by 1 order by 1 desc;

-- Virality: how many friends continued each puzzle (branching) and how deep chains get.
create or replace view public.chain_virality as
select
  n.id, n.depth, n.rule, n.created_at,
  (select count(*) from public.nodes c where c.parent_id = n.id)                       as children,
  (select count(*) from public.events e where e.node_id = n.id and e.kind = 'open')    as opens
from public.nodes n;

revoke all on public.gate_daily, public.chain_virality from anon, authenticated;
