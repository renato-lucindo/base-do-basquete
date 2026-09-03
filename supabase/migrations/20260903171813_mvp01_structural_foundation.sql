create table public.competition_ruleset_revisions (
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.competitions(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  structure_kind text not null check (
    structure_kind in ('regulated', 'legacy_unclassified')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'active', 'superseded')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competition_ruleset_revisions_competition_revision_unique
    unique (competition_id, revision_number),
  constraint competition_ruleset_revisions_id_competition_unique
    unique (id, competition_id)
);

create unique index competition_ruleset_revisions_one_active_uidx
  on public.competition_ruleset_revisions (competition_id)
  where status = 'active';

create table public.competition_stages (
  id bigint generated always as identity primary key,
  competition_id bigint not null,
  ruleset_revision_id bigint not null,
  code text not null check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  name text not null check (
    name = btrim(name) and char_length(name) between 2 and 120
  ),
  stage_order smallint not null check (stage_order > 0),
  structure_kind text not null check (
    structure_kind in ('regulated', 'legacy_unclassified')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competition_stages_revision_competition_fkey
    foreign key (ruleset_revision_id, competition_id)
    references public.competition_ruleset_revisions(id, competition_id)
    on delete restrict,
  constraint competition_stages_revision_code_unique
    unique (ruleset_revision_id, code),
  constraint competition_stages_id_competition_unique
    unique (id, competition_id)
);

create table public.competition_rounds (
  id bigint generated always as identity primary key,
  competition_id bigint not null,
  stage_id bigint not null,
  code text not null check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  name text not null check (
    name = btrim(name) and char_length(name) between 2 and 120
  ),
  round_order smallint not null check (round_order > 0),
  structure_kind text not null check (
    structure_kind in ('regulated', 'legacy_unclassified')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competition_rounds_stage_competition_fkey
    foreign key (stage_id, competition_id)
    references public.competition_stages(id, competition_id)
    on delete restrict,
  constraint competition_rounds_stage_code_unique unique (stage_id, code),
  constraint competition_rounds_id_competition_unique unique (id, competition_id)
);

create table public.matchups (
  id bigint generated always as identity primary key,
  competition_id bigint not null,
  round_id bigint not null,
  home_registration_id bigint not null,
  away_registration_id bigint not null,
  matchup_order integer not null check (matchup_order > 0),
  structure_kind text not null check (
    structure_kind in ('regulated', 'legacy_unclassified')
  ),
  allow_side_inversion boolean not null default false,
  legacy_game_id bigint unique references public.games(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matchups_distinct_registrations check (
    home_registration_id <> away_registration_id
  ),
  constraint matchups_round_competition_fkey
    foreign key (round_id, competition_id)
    references public.competition_rounds(id, competition_id) on delete restrict,
  constraint matchups_home_registration_competition_fkey
    foreign key (home_registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict,
  constraint matchups_away_registration_competition_fkey
    foreign key (away_registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict,
  constraint matchups_round_order_unique unique (round_id, matchup_order),
  constraint matchups_id_competition_unique unique (id, competition_id)
);

alter table public.games
  add column matchup_id bigint,
  add column matchup_game_number smallint;

alter table public.games
  add constraint games_matchup_competition_fkey
    foreign key (matchup_id, competition_id)
    references public.matchups(id, competition_id) on delete restrict,
  add constraint games_matchup_number_consistent check (
    (matchup_id is null and matchup_game_number is null)
    or (matchup_id is not null and matchup_game_number is not null and matchup_game_number > 0)
  ),
  add constraint games_matchup_game_number_unique
    unique (matchup_id, matchup_game_number);

create index games_matchup_idx on public.games (matchup_id)
  where matchup_id is not null;

insert into public.competition_ruleset_revisions (
  competition_id,
  revision_number,
  structure_kind,
  status
)
select distinct game.competition_id, 1, 'legacy_unclassified', 'active'
from public.games game
where not exists (
  select 1
  from public.competition_ruleset_revisions revision
  where revision.competition_id = game.competition_id
);

insert into public.competition_stages (
  competition_id,
  ruleset_revision_id,
  code,
  name,
  stage_order,
  structure_kind
)
select
  revision.competition_id,
  revision.id,
  'legacy_unclassified',
  'Histórico sem fase classificada',
  1,
  'legacy_unclassified'
from public.competition_ruleset_revisions revision
where revision.structure_kind = 'legacy_unclassified'
  and not exists (
    select 1 from public.competition_stages stage
    where stage.ruleset_revision_id = revision.id
      and stage.code = 'legacy_unclassified'
  );

insert into public.competition_rounds (
  competition_id,
  stage_id,
  code,
  name,
  round_order,
  structure_kind
)
select
  stage.competition_id,
  stage.id,
  'legacy_unclassified',
  'Histórico sem rodada classificada',
  1,
  'legacy_unclassified'
from public.competition_stages stage
where stage.structure_kind = 'legacy_unclassified'
  and not exists (
    select 1 from public.competition_rounds round_item
    where round_item.stage_id = stage.id
      and round_item.code = 'legacy_unclassified'
  );

with evidenced_games as (
  select
    game.id as game_id,
    game.competition_id,
    max(participant.registration_id) filter (where participant.side = 'home') as home_registration_id,
    max(participant.registration_id) filter (where participant.side = 'away') as away_registration_id
  from public.games game
  join public.game_participants participant on participant.game_id = game.id
  group by game.id, game.competition_id
  having count(*) = 2
    and count(*) filter (where participant.side = 'home') = 1
    and count(*) filter (where participant.side = 'away') = 1
), ranked_games as (
  select
    evidenced.*,
    row_number() over (
      partition by evidenced.competition_id order by evidenced.game_id
    )::integer as matchup_order
  from evidenced_games evidenced
)
insert into public.matchups (
  competition_id,
  round_id,
  home_registration_id,
  away_registration_id,
  matchup_order,
  structure_kind,
  allow_side_inversion,
  legacy_game_id
)
select
  ranked.competition_id,
  round_item.id,
  ranked.home_registration_id,
  ranked.away_registration_id,
  ranked.matchup_order,
  'legacy_unclassified',
  false,
  ranked.game_id
from ranked_games ranked
join public.competition_rounds round_item
  on round_item.competition_id = ranked.competition_id
  and round_item.structure_kind = 'legacy_unclassified'
where not exists (
  select 1 from public.matchups matchup where matchup.legacy_game_id = ranked.game_id
);

update public.games game
set matchup_id = matchup.id,
    matchup_game_number = 1
from public.matchups matchup
where matchup.legacy_game_id = game.id
  and game.matchup_id is null;

create trigger competition_ruleset_revisions_set_updated_at
before update on public.competition_ruleset_revisions
for each row execute function private.set_updated_at();
create trigger competition_stages_set_updated_at
before update on public.competition_stages
for each row execute function private.set_updated_at();
create trigger competition_rounds_set_updated_at
before update on public.competition_rounds
for each row execute function private.set_updated_at();
create trigger matchups_set_updated_at
before update on public.matchups
for each row execute function private.set_updated_at();

alter table public.competition_ruleset_revisions enable row level security;
alter table public.competition_ruleset_revisions force row level security;
alter table public.competition_stages enable row level security;
alter table public.competition_stages force row level security;
alter table public.competition_rounds enable row level security;
alter table public.competition_rounds force row level security;
alter table public.matchups enable row level security;
alter table public.matchups force row level security;

create policy competition_ruleset_revisions_admin_select
on public.competition_ruleset_revisions for select to authenticated
using ((select public.is_current_admin_aal2()));
create policy competition_stages_admin_select
on public.competition_stages for select to authenticated
using ((select public.is_current_admin_aal2()));
create policy competition_rounds_admin_select
on public.competition_rounds for select to authenticated
using ((select public.is_current_admin_aal2()));
create policy matchups_admin_select
on public.matchups for select to authenticated
using ((select public.is_current_admin_aal2()));

revoke all on public.competition_ruleset_revisions from public, anon, authenticated;
revoke all on public.competition_stages from public, anon, authenticated;
revoke all on public.competition_rounds from public, anon, authenticated;
revoke all on public.matchups from public, anon, authenticated;
revoke all on sequence public.competition_ruleset_revisions_id_seq from public, anon, authenticated;
revoke all on sequence public.competition_stages_id_seq from public, anon, authenticated;
revoke all on sequence public.competition_rounds_id_seq from public, anon, authenticated;
revoke all on sequence public.matchups_id_seq from public, anon, authenticated;
grant select on public.competition_ruleset_revisions to authenticated;
grant select on public.competition_stages to authenticated;
grant select on public.competition_rounds to authenticated;
grant select on public.matchups to authenticated;

create view public.legacy_unclassified_games
with (security_invoker = true)
as
select
  game.id as game_id,
  game.competition_id,
  game.game_number,
  game.matchup_id,
  case when game.matchup_id is null then 'missing_participants' else 'legacy_unclassified' end as review_reason
from public.games game
left join public.matchups matchup on matchup.id = game.matchup_id
where (select public.is_current_admin_aal2())
  and (game.matchup_id is null or matchup.structure_kind = 'legacy_unclassified');

revoke all on public.legacy_unclassified_games from public, anon, authenticated;
grant select on public.legacy_unclassified_games to authenticated;

comment on column public.games.matchup_id is
  'Optional for historical compatibility; all new application-created games must reference a valid matchup.';
comment on table public.matchups is
  'Versioned structural game container. legacy_unclassified records evidence without inferring phase or round.';
