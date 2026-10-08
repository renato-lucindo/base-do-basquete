// Integration test exclusively against the disposable Supabase Docker database in CI.
// No remote database URL, credential, or host argument is accepted.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

if (process.env.CI !== "true") throw new Error("Run only in the disposable CI database.");
const container = "supabase_db_base-do-basquete";
const runId = randomUUID();
const application = `mvp03-race-${runId}`;
const authContext = `do $$begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',
    (select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
end$$;`;

function connection(sql, keepOpen = false) {
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
  let markReady;
  const ready = new Promise((resolve) => {
    markReady = resolve;
  });
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
    if (output.includes("barrier-ready")) markReady();
  });
  child.stderr.on("data", (chunk) => {
    errors += chunk.toString();
  });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(`Local psql failed: ${errors}`)),
    );
  });
  // Attach a rejection handler immediately, including while a lock barrier is being prepared.
  done.catch(() => {});
  child.stdin.on("error", () => {});
  if (keepOpen) child.stdin.write(sql);
  else child.stdin.end(sql);
  return { child, done, ready };
}
async function run(sql) {
  const session = connection(sql);
  const timer = setTimeout(() => session.child.kill(), 20000);
  try {
    return await session.done;
  } finally {
    clearTimeout(timer);
  }
}
async function race(lock, statements) {
  const barrier = connection(`begin; ${lock}; select 'barrier-ready';\n`, true);
  const clients = [];
  const watchdog = setTimeout(() => {
    barrier.child.kill();
    for (const client of clients) client.child.kill();
  }, 30000);
  try {
    await Promise.race([
      barrier.ready,
      barrier.done.then(() => {
        throw new Error("Barrier closed early");
      }),
    ]);
    for (const statement of statements) {
      clients.push(
        connection(
          `set application_name='${application}'; begin; ${authContext} ${statement}; commit;`,
        ),
      );
    }
    let waiting = 0;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      waiting = Number(
        await run(
          `select count(*) from pg_stat_activity where application_name='${application}' and wait_event_type='Lock';`,
        ),
      );
      if (waiting === 2) break;
      await delay(100);
    }
    assert.equal(
      waiting,
      2,
      "both independent connections must be blocked before releasing the barrier",
    );
    barrier.child.stdin.end("commit;\n");
    await barrier.done;
    return await Promise.all(clients.map((client) => client.done));
  } finally {
    clearTimeout(watchdog);
    if (!barrier.child.stdin.destroyed) barrier.child.stdin.end("rollback;\n");
    for (const client of clients) if (client.child.exitCode === null) client.child.kill();
  }
}

const fixture = JSON.parse(
  await run(`begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id) select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);
with s as (insert into public.competition_series(name,slug) values('Concurrency fixture','race-${runId}') returning id),
c as (insert into public.categories(name,slug) values('Concurrency fixture','race-${runId}') returning id)
select jsonb_build_object('series',s.id,'category',c.id) from s,c;
commit;`),
);
const requestId = randomUUID();
const payload = JSON.stringify({
  seriesId: fixture.series,
  categoryId: fixture.category,
  year: 2026,
  name: "Concurrent private edition",
  gender: "male",
  source: "manual_scoresheet",
  preset: "single_elimination",
  entryCount: 4,
  startsOn: null,
  endsOn: null,
  expectedProfileId: null,
  reason: null,
  reviewed: true,
});
const create = `set local role authenticated; select public.admin_create_competition_from_preset('${requestId}',$input$${payload}$input$::jsonb)`;
const created = await race(`select pg_advisory_xact_lock(hashtextextended('${requestId}',310))`, [
  create,
  create,
]);
assert.match(created[0], /^\d+$/);
assert.equal(created[0], created[1], "simultaneous first writes return the same committed edition");
const counts = JSON.parse(
  await run(`select jsonb_build_object(
'editions',(select count(*) from public.competitions where series_id=${fixture.series}),
'audits',(select count(*) from public.admin_mutation_audit where action='competition_created_from_preset' and entity_id=${created[0]}),
'revisions',(select count(*) from public.competition_ruleset_revisions where competition_id=${created[0]}))`),
);
assert.deepEqual(counts, { editions: 1, audits: 1, revisions: 1 });
console.log("PASS: concurrent first-write idempotency, exactly one edition/revision/audit");

const divisionFixture = JSON.parse(
  await run(`begin; ${authContext}
set local role authenticated;
select jsonb_build_object(
  'gold', public.admin_add_competitive_division_value('${randomUUID()}',
    (select season_id from public.competitions where id=${created[0]}),'Série','serie','Ouro','ouro',1),
  'silver', public.admin_add_competitive_division_value('${randomUUID()}',
    (select season_id from public.competitions where id=${created[0]}),'Série','serie','Prata','prata',2)
); commit;`),
);
function divisionContender(valueId) {
  return `create function pg_temp.division_contender() returns text language plpgsql as $$begin
    perform public.admin_assign_competition_competitive_division(${created[0]},null,${valueId});
    return 'accepted';
  exception when sqlstate 'BD409' then
    if sqlerrm <> 'BDB_COMPETITION_DIVISION_STALE' then raise; end if;
    return 'stale';
  end$$; set local role authenticated;
  select pg_temp.division_contender()`;
}
const divisionOutcomes = await race(
  `select id from public.competitions where id=${created[0]} for update`,
  [divisionContender(divisionFixture.gold), divisionContender(divisionFixture.silver)],
);
assert.deepEqual(divisionOutcomes.sort(), ["accepted", "stale"]);
const winningDivision = Number(
  await run(`select competitive_division_value_id from public.competitions where id=${created[0]}`),
);
assert.ok([divisionFixture.gold, divisionFixture.silver].includes(winningDivision));
assert.equal(
  Number(
    await run(`select count(*) from public.admin_mutation_audit
    where action='competition_competitive_division_assigned' and entity_id=${created[0]}`),
  ),
  1,
);
await run(`begin; ${authContext} set local role authenticated;
  select public.admin_assign_competition_competitive_division(${created[0]},null,${winningDivision}); commit;`);
assert.equal(
  Number(
    await run(`select count(*) from public.admin_mutation_audit
    where action='competition_competitive_division_assigned' and entity_id=${created[0]}`),
  ),
  1,
);
console.log(
  "PASS: divergent division CAS accepts one writer, rejects stale writer, and retries once",
);

const raceToken = runId.replaceAll("-", "").slice(0, 8);
const manualFixture = JSON.parse(
  await run(`begin; ${authContext}
with teams as (
  insert into public.teams(name,slug) values
    ('Manual race home ${raceToken}','manual-race-home-${raceToken}'),
    ('Manual race away ${raceToken}','manual-race-away-${raceToken}')
  returning id
), registrations as (
  insert into public.team_registrations(competition_id,team_id,status,confirmed_at)
  select ${created[0]},id,'confirmed',now() from teams
  returning id
)
select jsonb_build_object('home',min(id),'away',max(id)) from registrations;
commit;`),
);
const manualRequestId = randomUUID();
const createManual = `set local role authenticated; select public.admin_create_manual_matchup('${manualRequestId}',${created[0]},null,${manualFixture.home},${manualFixture.away},null,'Concurrency court')`;
const manualCreated = await race(
  `select id from public.competitions where id=${created[0]} for update`,
  [createManual, createManual],
);
assert.equal(
  manualCreated[0],
  manualCreated[1],
  "simultaneous manual matchup retries return the same committed result",
);
const manualResult = JSON.parse(manualCreated[0]);
const manualCounts = JSON.parse(
  await run(`select jsonb_build_object(
'requests',(select count(*) from private.manual_matchup_requests where request_id='${manualRequestId}'),
'audits',(select count(*) from public.admin_mutation_audit where action='manual_matchup_created' and entity_id=${manualResult.matchupId}),
'games',(select count(*) from public.games where id=${manualResult.gameId}))`),
);
assert.deepEqual(manualCounts, { requests: 1, audits: 1, games: 1 });
console.log("PASS: concurrent manual matchup retry creates one request/matchup/game/audit");

const sameTeamName = `Concurrent Wolves ${raceToken}`;
const createSameTeam = `set local role authenticated; select (public.admin_create_team('${sameTeamName}',null)).id`;
const sameTeam = await race(
  `select pg_advisory_xact_lock(hashtextextended('team-name:${sameTeamName.toLowerCase()}',0))`,
  [createSameTeam, createSameTeam],
);
assert.equal(
  sameTeam[0],
  sameTeam[1],
  "same normalized team name resolves to one team under concurrency",
);
assert.equal(Number(await run(`select count(*) from public.teams where id=${sameTeam[0]}`)), 1);
console.log("PASS: concurrent identical team creation resolves to one team");

const slugNameOne = `Slug Race ${raceToken}`;
const slugNameTwo = `Slug-Race ${raceToken}`;
const slugBase = `slug-race-${raceToken}`;
const slugTeams = await race(
  `select pg_advisory_xact_lock(hashtextextended('team-slug:${slugBase}',0))`,
  [
    `set local role authenticated; select (public.admin_create_team('${slugNameOne}',null)).id`,
    `set local role authenticated; select (public.admin_create_team('${slugNameTwo}',null)).id`,
  ],
);
assert.notEqual(slugTeams[0], slugTeams[1], "distinct colliding names remain distinct teams");
const slugValues = (
  await run(`select slug from public.teams where id in (${slugTeams.join(",")}) order by slug`)
).split("\n");
assert.deepEqual(slugValues, [slugBase, `${slugBase}-2`]);
console.log("PASS: concurrent slug collisions serialize and receive deterministic suffixes");

const draft = JSON.parse(
  await run(`begin; ${authContext}
create temporary table race_context(value jsonb);
do $$declare c bigint; rev bigint; st bigint; rnd bigint; e bigint; sl bigint; profile bigint; slots bigint[] := '{}'; i integer;
begin
  select id into strict profile
  from public.series_category_data_profiles
  where series_id=${fixture.series} and category_id=${fixture.category}
    and gender_division='male' and status='active';
  insert into public.competitions(
    series_id,category_id,year,display_name,
    gender_division,gender_division_review_required,
    data_profile_id,data_profile_review_required,
    data_profile_validated_at,data_profile_validated_by
  ) values(
    ${fixture.series},${fixture.category},2000,'Concurrent semifinal fixture',
    'male',false,profile,false,clock_timestamp(),auth.uid()
  ) returning id into c;
  insert into public.competition_ruleset_revisions(competition_id,revision_number,structure_kind,preset_key,preset_version,entry_count,created_by)
  values(c,1,'regulated','single_elimination',1,6,auth.uid()) returning id into rev;
  insert into public.competition_stages(competition_id,ruleset_revision_id,code,name,stage_order,structure_kind)
  values(c,rev,'test','Teste',1,'regulated') returning id into st;
  insert into public.competition_rounds(competition_id,stage_id,ruleset_revision_id,code,name,round_order,structure_kind,round_role,capacity,max_matchups)
  values(c,st,rev,'semifinal','Semifinal',1,'regulated','semifinal',4,2) returning id into rnd;
  for i in 1..6 loop
    insert into public.competition_entries(competition_id,ruleset_revision_id,seed) values(c,rev,i) returning id into e;
    insert into public.competition_slots(competition_id,ruleset_revision_id,round_id,origin_kind,entry_id)
    values(c,rev,rnd,'entry',e) returning id into sl;
    slots:=array_append(slots,sl);
  end loop;
  insert into public.matchups(competition_id,round_id,ruleset_revision_id,code,home_slot_id,away_slot_id,matchup_order,structure_kind,match_format,max_games)
  values(c,rnd,rev,'initial',slots[1],slots[2],1,'regulated','single_game',1);
  insert into race_context values(jsonb_build_object('competition',c,'revision',rev,'round',rnd,'slots',slots));
end$$;
select value from race_context; commit;`),
);
function contender(order) {
  return `create function pg_temp.contender() returns text language plpgsql as $$begin
    insert into public.matchups(competition_id,round_id,ruleset_revision_id,code,home_slot_id,away_slot_id,matchup_order,structure_kind,match_format,max_games)
    values(${draft.competition},${draft.round},${draft.revision},'candidate_${order}',${draft.slots[2 * order - 2]},${draft.slots[2 * order - 1]},${order},'regulated','single_game',1);
    return 'accepted';
    exception when sqlstate 'BR006' then return 'capacity-rejected';
  end$$; select pg_temp.contender()`;
}
// Owner-role writes intentionally exercise the trigger beyond the normal denial of direct writes.
const outcomes = await race(
  `select id from public.competition_ruleset_revisions where id=${draft.revision} for update`,
  [contender(2), contender(3)],
);
assert.deepEqual(outcomes.sort(), ["accepted", "capacity-rejected"]);
assert.equal(
  Number(await run(`select count(*) from public.matchups where round_id=${draft.round}`)),
  2,
);
console.log("PASS: competing semifinal writes serialize; third matchup rejected");

const editionRequest = randomUUID();
const editionInput = {
  seriesId: null,
  championshipName: `Edition race ${runId}`,
  seasonId: null,
  categoryKind: "adult",
  categoryAge: null,
  year: 2026,
  gender: "male",
  description: null,
  startsOn: null,
  endsOn: null,
  divisionMode: "none",
  divisionValueId: null,
  divisionTypeName: null,
  divisionValueName: null,
  source: "manual_scoresheet",
  preset: "single_group",
  entryCount: 4,
  expectedProfileId: null,
  reason: null,
  reviewed: true,
};
const editionCall = `set local role authenticated; select public.admin_create_competition_edition('${editionRequest}', '${JSON.stringify(editionInput)}'::jsonb)`;
const editionResults = await race(
  `select pg_advisory_xact_lock(hashtextextended('${editionRequest}',431))`,
  [editionCall, editionCall],
);
assert.equal(editionResults[0], editionResults[1], "concurrent exact retry returns identical IDs");
const editionResult = JSON.parse(editionResults[0]);
assert.equal(
  Number(
    await run(
      `select count(*) from private.edition_creation_requests where request_id='${editionRequest}'`,
    ),
  ),
  1,
);
assert.equal(
  Number(
    await run(
      `select count(*) from public.admin_mutation_audit where action='edition_workflow_created' and entity_id=${editionResult.seasonId}`,
    ),
  ),
  1,
);
console.log("PASS: concurrent complete edition creation is idempotent with one ledger and audit");
const editionSeries = Number(
  await run(`select series_id from public.competition_seasons where id=${editionResult.seasonId}`),
);
const competingEdition = {
  ...editionInput,
  seriesId: editionSeries,
  championshipName: null,
  year: 2025,
  categoryKind: "base",
  categoryAge: 12,
};
const contenderEdition =
  () => `set local role authenticated; create function pg_temp.create_edition_contender() returns text language plpgsql as $$begin
  perform public.admin_create_competition_edition('${randomUUID()}','${JSON.stringify(competingEdition)}'::jsonb);
  return 'accepted'; exception when sqlstate 'BD506' then return 'duplicate'; end$$;
  select pg_temp.create_edition_contender()`;
const editionOutcomes = await race(
  `select pg_advisory_xact_lock(hashtextextended('${editionSeries}:2025',417))`,
  [contenderEdition(), contenderEdition()],
);
assert.deepEqual(editionOutcomes.sort(), ["accepted", "duplicate"]);
assert.equal(
  Number(
    await run(
      `select count(*) from public.competition_seasons where series_id=${editionSeries} and year=2025`,
    ),
  ),
  1,
);
console.log("PASS: competing edition requests serialize; one accepted and one explicit duplicate");
