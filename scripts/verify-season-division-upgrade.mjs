// Verifies the real season/division migration over the disposable legacy fixture.
// It accepts no remote database target and is intentionally restricted to CI.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

if (process.env.CI !== "true") throw new Error("Run only in the disposable CI database.");

const container = "supabase_db_base-do-basquete";

function run(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-X",
        "-qAt",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "";
    let errors = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      errors += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(`Local psql failed: ${errors}`));
    });
    child.stdin.end(sql);
  });
}

const raw = await run(`
select jsonb_build_object(
  'competitionIds', (
    select jsonb_agg(id order by id)
    from public.competitions
    where id in (91001, 91002, 91003)
  ),
  'seasonCount', (
    select count(*)
    from public.competition_seasons season
    join public.competition_series series on series.id = season.series_id
    where series.slug = 'liga-upgrade'
      and season.year = 2030
  ),
  'seasonName', (
    select season.name
    from public.competition_seasons season
    join public.competition_series series on series.id = season.series_id
    where series.slug = 'liga-upgrade'
      and season.year = 2030
  ),
  'suggestedStartsOn', (
    select season.suggested_starts_on
    from public.competition_seasons season
    join public.competition_series series on series.id = season.series_id
    where series.slug = 'liga-upgrade'
      and season.year = 2030
  ),
  'suggestedEndsOn', (
    select season.suggested_ends_on
    from public.competition_seasons season
    join public.competition_series series on series.id = season.series_id
    where series.slug = 'liga-upgrade'
      and season.year = 2030
  ),
  'linkedDisputes', (
    select count(*)
    from public.competitions
    where id in (91001, 91002, 91003)
      and season_id is not null
      and competitive_division_value_id is null
  ),
  'sharedSeasonCount', (
    select count(distinct season_id)
    from public.competitions
    where id in (91001, 91002, 91003)
  ),
  'genderCount', (
    select count(distinct gender_division)
    from public.competitions
    where id in (91001, 91002, 91003)
  ),
  'legacySeasonAliasCount', (
    select count(*)
    from private.competition_season_id_aliases alias
    join public.competition_seasons season on season.id = alias.season_id
    join public.competition_series series on series.id = season.series_id
    where series.slug = 'liga-upgrade'
      and season.year = 2030
  ),
  'legacySeasonAliasesResolve', (
    select bool_and(private.resolve_competition_season_id(alias.legacy_id) = alias.season_id)
    from private.competition_season_id_aliases alias
    join public.competition_seasons season on season.id = alias.season_id
    join public.competition_series series on series.id = season.series_id
    where series.slug = 'liga-upgrade'
      and season.year = 2030
  ),
  'linkedGames', (
    select count(*) from public.games
    where id = 92001 and competition_id = 91001
  ),
  'linkedPublications', (
    select count(*) from public.competition_publications
    where id = 93001
      and competition_id = 91001
      and snapshot ->> 'upgradeMarker' = 'preserve-me'
  )
)::text;
`);

const evidence = JSON.parse(raw);
assert.deepEqual(
  evidence.competitionIds,
  [91001, 91002, 91003],
  "historical competition IDs changed",
);
assert.equal(evidence.seasonCount, 1, "gender-specific editions were not consolidated");
assert.equal(evidence.seasonName, "Liga Upgrade", "season name was inferred from a dispute");
assert.equal(evidence.suggestedStartsOn, "2030-03-01", "earliest date was not preserved");
assert.equal(evidence.suggestedEndsOn, "2030-11-30", "latest date was not preserved");
assert.equal(evidence.linkedDisputes, 3, "disputes were not preserved without division inference");
assert.equal(evidence.sharedSeasonCount, 1, "male and female disputes do not share one edition");
assert.equal(evidence.genderCount, 2, "dispute genders were not preserved");
assert.equal(evidence.legacySeasonAliasCount, 2, "legacy edition IDs were not mapped");
assert.equal(evidence.legacySeasonAliasesResolve, true, "legacy edition aliases do not resolve");
assert.equal(evidence.linkedGames, 1, "historical game link changed");
assert.equal(evidence.linkedPublications, 1, "historical publication link or snapshot changed");

const publicRegistrations = await run(`
set role anon;
select coalesce(jsonb_agg(id order by id), '[]')::text
from public.team_registrations where id in (94001,94002,94003);
`);
assert.deepEqual(
  JSON.parse(publicRegistrations),
  [94001],
  "upgrade changed anonymous visibility or exposed pending registration edits",
);
const renamedVisibility = await run(`
begin;
update public.team_registrations set public_name='Upgrade Nome Pendente' where id=94001;
set local role anon;
select count(*) from public.team_registrations where id=94001;
rollback;
`);
assert.equal(
  renamedVisibility,
  "0",
  "legacy publication exposed an unpublished public-name change",
);
console.log("season/division upgrade and legacy publication visibility compatibility passed");
