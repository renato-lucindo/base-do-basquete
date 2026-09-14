begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_view(
  'public', 'game_scoresheet_player_statistics',
  'the simple manual-edition game projection remains available'
);
select has_view(
  'public', 'competition_scoresheet_player_statistics',
  'the simple manual-edition ranking projection remains available'
);
select ok(
  pg_get_viewdef('public.game_scoresheet_player_statistics'::regclass, true)
    like '%primary_source = ''manual_scoresheet''%',
  'the projection is still restricted to editions configured as manual-primary'
);
select ok(
  pg_get_viewdef('public.game_scoresheet_player_statistics'::regclass, true)
    like '%participation.source_type = ANY (ARRAY[''manual_scoresheet''::text, ''fiba_boxscore''::text])%',
  'reviewed FIBA supplemental participation can feed the simple projection'
);
select ok(
  pg_get_viewdef('public.game_scoresheet_player_statistics'::regclass, true)
    like '%scoring.source_type = ANY (ARRAY[''manual_scoresheet''::text, ''fiba_boxscore''::text])%',
  'reviewed FIBA supplemental scoring can feed the simple projection'
);
select ok(
  pg_get_viewdef('public.game_scoresheet_player_statistics'::regclass, true)
    like '%foul_total.source_type = ANY (ARRAY[''manual_scoresheet''::text, ''fiba_boxscore''::text])%',
  'reviewed FIBA supplemental foul totals can feed the simple projection'
);
select ok(
  pg_get_viewdef('public.game_scoresheet_player_statistics'::regclass, true)
    like '%foul_timeline.source_type = ''manual_scoresheet''%',
  'disqualification stays unavailable unless a manual foul timeline exists'
);
select hasnt_column(
  'public', 'competition_scoresheet_player_statistics', 'efficiency',
  'the simple ranking does not expose an advanced efficiency aggregate'
);
select hasnt_column(
  'public', 'competition_scoresheet_player_statistics', 'plus_minus',
  'the simple ranking does not expose an advanced plus-minus aggregate'
);
select ok(
  has_table_privilege('anon', 'public.game_scoresheet_player_statistics', 'select')
    and has_table_privilege(
      'anon', 'public.competition_scoresheet_player_statistics', 'select'
    ),
  'the safe projection remains available to anonymous public reads'
);

select * from finish();
rollback;
