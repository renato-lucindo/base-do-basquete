-- Cover the contextual foreign keys used to preserve publication membership.
create index competition_publication_games_publication_context_idx
  on private.competition_publication_games(publication_id,competition_id);
create index competition_publication_registrations_publication_context_idx
  on private.competition_publication_registrations(publication_id,competition_id);
create index competition_publication_roster_entries_publication_context_idx
  on private.competition_publication_roster_entries(publication_id,competition_id);

-- The public snapshot is already protected by grants and RLS on both source
-- tables. Run with the caller's privileges instead of bypassing those controls.
create or replace function public.public_get_competition_publication(p_competition_id bigint)
returns jsonb language sql stable security invoker set search_path='' as $$
  select publication.snapshot
  from public.competitions competition
  join public.competition_publications publication
    on publication.id=competition.current_publication_id
  where competition.id=p_competition_id
    and competition.status in('published','archived');
$$;
revoke all on function public.public_get_competition_publication(bigint)
  from public,anon,authenticated;
grant execute on function public.public_get_competition_publication(bigint)
  to anon,authenticated;

comment on function public.public_get_competition_publication(bigint) is
  'Public allowlisted snapshot for the current explicit publication; executes as the caller so table grants and RLS remain authoritative.';
