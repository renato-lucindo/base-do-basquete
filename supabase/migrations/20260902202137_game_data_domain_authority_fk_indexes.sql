create index game_data_domain_authority_submission_context_idx
  on public.game_data_domain_authority (submission_id, game_id, source_type);

create index game_data_domain_authority_capability_idx
  on public.game_data_domain_authority (source_type, domain);

comment on index public.game_data_domain_authority_submission_context_idx is
  'Covers the contextual submission foreign key used by authority validation.';
comment on index public.game_data_domain_authority_capability_idx is
  'Covers the source/domain capability foreign key and capability joins.';
