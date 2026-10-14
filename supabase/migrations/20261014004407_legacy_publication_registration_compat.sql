-- Preserve legacy publication membership without rewriting immutable snapshots
-- or refreshing fingerprints from potentially unpublished editorial changes.
create or replace function private.registration_is_currently_published(p_registration_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.competitions competition
    join private.competition_publication_registrations member
      on member.publication_id = competition.current_publication_id
      and member.competition_id = competition.id
    join public.competition_publications publication
      on publication.id = member.publication_id
      and publication.competition_id = member.competition_id
    join public.team_registrations registration
      on registration.id = member.registration_id
      and registration.competition_id = member.competition_id
    where member.registration_id = p_registration_id
      and competition.status in ('published', 'archived')
      and (
        member.fingerprint = private.publication_registration_fingerprint(p_registration_id)
        or (
          member.fingerprint = md5(jsonb_build_object(
            'id', registration.id, 'competitionId', registration.competition_id,
            'teamId', registration.team_id, 'status', registration.status,
            'confirmedAt', registration.confirmed_at
          )::text)
          and exists (
            select 1 from jsonb_array_elements(publication.snapshot -> 'teams') team
            where team ->> 'registrationId' = registration.id::text
              and team ->> 'id' = registration.team_id::text
              and not (team ? 'teamId')
              and team ->> 'name' = registration.public_name
          )
        )
      )
  );
$$;
revoke all on function private.registration_is_currently_published(bigint)
  from public, anon, authenticated;
grant execute on function private.registration_is_currently_published(bigint)
  to anon, authenticated;
