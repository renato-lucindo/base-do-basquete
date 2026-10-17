# Rollout compartilhado — 16/10/2026

Preparação operacional pelo project-maintainer; não representa aplicação remota concluída. Fonte funcional revisada: c804042068e24fabea46c3c5181c8f411227fb43. PRs86/87 integradas, PR77 com cinco pareceres e gates verdes.

## Backup recuperável

Criado2026-10-17T01:47:22.939Z: PostgreSQL17.11 custom public/private/auth/storage, roles sem senhas de roles e seis PDFs privados. AES256GCM; leitura/descriptografia/checksums/pg_restore--list aprovados. KV privado não vinculado a Worker90f6c94e6b534a138ed3f9cd6d4fc3ea, chavepre-rollout/20261016/8D33EAE7. Chave criptográfica somente no secretGitHubBDB_BACKUP_KEY_20261016_8D33EAE7. SHA256 do arquivo criptografado18e1eaec5347b7800db37fe51acd25833ceaf1a858e4e00ddbb1b7a96e97ee3a;1065102bytes. Sem TTL: manter até ensaio de restauração e descarte autorizado. Evidência remota issue83comentário6228156629.

Recuperação: runner autorizado obtém o secret do vault e o ciphertext do KV privado, valida SHA256, decifra envelopebdb-aes256gcm-v1 (iv/tag/ciphertext base64), descompacta gzip JSONbdb-logical-backup-v1, valida database/roles/objects por SHA256. Restaurar somente em staging vazio e isolado; nunca sobre origem sem intervenção humana. Nenhuma chave ou dado privado está neste documento. Restauração integral do backup criptografado ainda não ensaiada; decriptação, checksums e catálogo foram verificados.

## Ordem e compatibilidade

Preservar aliases históricos20261005140439/20261005140504; não reaplicar Auth20261016130432. Fontes de cada migration no diretório supabase/migrations, sem repair/dbpush cego. A versão produção4a89109e-1b78-4f13-aa57-b45764f40338 corresponde ao SHA3ae53341f4b708f7b0d3afdf49f0309f34850c82, comprovado pelo run36171540445. Git e conteúdo do Worker ativo não referenciam competition_seasons/competitive_division/public_name; contrato antigo de inscrição continua disponível. Rollback de Worker não desfaz migrations; preferir correção progressiva caso incompatível.

Após revisão do procedimento: aplicar cadeia atomicamente, validar previewPR77 autenticado, integrarPR77, carregar candidata produção a partir de mainverde e versão marcada, promover somente após gates. Main sem proteção (API404); nenhuma alegação de proteção. AGENTS permite release por versão marcada.

## Ensaio e reconciliação

Restauração de cópia atual do remoto em PostgreSQL17 local127.0.0.1:55439; aplicação das19migrations e reconciliação PASS; cluster parado e removido ao terminar. Restore local usa no-owner/no-privileges para adaptar roles gerenciadas; isso não substitui pgTAP/RLS/GoTrue real no CI. Foram preservadas71tabelas existentes,12inscrições publicadas e helpersAuth. Normalização do hash somente para coluna de gênero removida/navdefault em temporada e public_name/updated_at de inscrições; exige nome exato da equipe e updated_at igual ao instante da transação. UTC explícito evita diferença de fingerprint por timezone. Dados estatísticos, publicações imutáveis, ledgers, auditoria e demais fatos são comparados integralmente.

Quatro tabelas privadas antigas sem RLS não são expostas; nenhum estado de RLS/grant existente é alterado. Todas as tabelas públicas e novas privadas exigem RLS. Nenhum teste/fixture é escrito no banco compartilhado.

```json
{
  "target": "127.0.0.1:55439 isolated temporary cluster",
  "sourceProject": "yjnbemfeyjhxhomprlnm",
  "trial": "PASS",
  "createdAt": "2026-10-17T02:05:50.543Z",
  "result": [
    "{\"migrations_added\": 19, \"published_members\": 12, \"auth_helpers_unchanged\": true, \"domain_hashes_unchanged\": true, \"existing_tables_reconciled\": 71}\r"
  ]
}
```

## Manifesto exato

```json
{
  "head": "c804042068e24fabea46c3c5181c8f411227fb43",
  "project": "yjnbemfeyjhxhomprlnm",
  "migrations": [
    {
      "name": "20261005183643_edition_identity_no_gender.sql",
      "sha256": "f28886dc6fe3b6103844596d64011bc20cdcaae954bee2d283824b5ce1a088c1"
    },
    {
      "name": "20261005193000_independent_team_registrations.sql",
      "sha256": "bc9e3e68c2f3f848a7c607d945eaf666c743c0c1281b72e3fafcc76490e3b0d7"
    },
    {
      "name": "20261006114000_registration_copy_sql_fixes.sql",
      "sha256": "421f032e103e511f8d6b301fed4cbd07b357d3b63b79f50f85b80e7eb81d4c54"
    },
    {
      "name": "20261006115000_registration_copy_lateral_joins.sql",
      "sha256": "de8b76e3aef30fabb233e7d2e104583c3c91d9d8ca6e87fc8f662642c159e3cb"
    },
    {
      "name": "20261006123600_multi_dispute_creation_navigation.sql",
      "sha256": "c73f0c4e4aa43563db1bc0a0c424a8907b8fed5ade972bacebbf063f2db1431d"
    },
    {
      "name": "20261008104500_multi_dispute_batch_variable_disambiguation.sql",
      "sha256": "898523c12b5112dbf1e0883c25f566673d08f37cb87551134fdd6de7cf48bf39"
    },
    {
      "name": "20261013191057_keyboard_scoresheet_events.sql",
      "sha256": "144a0b95e17ca8d37ae56bc0f00c319958b017fd3ee3d36e616dacbb00c3a139"
    },
    {
      "name": "20261014004407_legacy_publication_registration_compat.sql",
      "sha256": "44d5ec15fd042b70b7df2eaf20c7778c86a43e1862ec4dfb111784bf2767153f"
    },
    {
      "name": "20261014004539_boxscore_registration_identity_contract.sql",
      "sha256": "26f89db0a2a76e12835274c6153c2083d018e9518f2930b777b4a8970292622b"
    },
    {
      "name": "20261014054203_boxscore_registration_bound_persistence.sql",
      "sha256": "5a2b216e74d8b8d19314468d903461c61290f9d87a3c3da170f261af1d5487d7"
    },
    {
      "name": "20261014110514_multi_dispute_shared_profile_context.sql",
      "sha256": "e9e183cde3253efc8f3abbc0afabc3b4a520797cadfe0b5d29b07e9dfaf479ee"
    },
    {
      "name": "20261014180500_keyboard_public_player_statistics.sql",
      "sha256": "1b51e849bd7ccd4b17db36f1a3fe3a517d671685d2857d5c422ec2f21f8be229"
    },
    {
      "name": "20261014210000_keyboard_boxscore_draft_guard.sql",
      "sha256": "795e160f3629ff109f540d19b4f05a57aa906b365cfe838b5253cb09fe276f9f"
    },
    {
      "name": "20261014223000_keyboard_fallback_history.sql",
      "sha256": "afff7db209baad4e05e1d72064845b63a17e15b3a97363236a56449be451a96d"
    },
    {
      "name": "20261014224000_keyboard_fallback_revision_guard.sql",
      "sha256": "96bbd4c41799322cf869daf5ca080f36c57373a1c356684a558f5bf4fbfb50a1"
    },
    {
      "name": "20261014225000_fiba_historical_registration_statistics.sql",
      "sha256": "8fc96456b701b16d93a846f2b57b39656b066f10b7abae42e84ba011971fad49"
    },
    {
      "name": "20261014225500_keyboard_reject_post_disqualification_scores.sql",
      "sha256": "c868c46b9acf9ef2a9a93c849835b2b4ac0c1516520ed9b1a6f9ea4f853f8859"
    },
    {
      "name": "20261014230000_keyboard_late_fiba_candidate_dispatch.sql",
      "sha256": "5e1b92e69cf0960f55e24280c163f6c0b0a03d50adcc5f39cfbbc24e0c0d6a76"
    },
    {
      "name": "20261016173000_batch_ordered_category_locks.sql",
      "sha256": "d766da30a92d46f4dcd8d6f47e8e83eba7db99d529c70bb38204ab0468f4022f"
    }
  ],
  "sqlSha256": "8b7b4b58e1cae1115e98a7b2c7939bbff950ee60c73f7e802ac32c2582e35474"
}
```

## Reprodução do SQL operacional

Salvar o gerador abaixo em tmp/build-rollout.cjs e executar com Node na árvore do SHA revisado. Ele apenas gera tmp/rollout-atomic.sql e manifesto; não conecta nem aplica ao banco. Conferir hashes/fontes/19arquivos contra manifesto antes de executar. Após aprovação, CLI oficial dbquery --linked --project-ref yjnbemfeyjhxhomprlnm --file tmp/rollout-atomic.sql pelo ManagementAPI (sem credenciais na linha de comando). Locks e inventário acontecem na mesma transação; falhas abortam tudo. Fonte enviada e registros de histórico são exatos.

```javascript
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const names = fs.readdirSync('supabase/migrations').filter(n => /^202610/.test(n) && n >= '20261005183643' && !n.startsWith('20261016130432')).sort();
if (names.length !== 19) throw Error('Unexpected migration inventory');
const manifest = names.map(name => { const source = fs.readFileSync('supabase/migrations/' + name, 'utf8'); if (/^\s*(begin|commit|rollback)\s*;/im.test(source)) throw Error('Nested transaction'); return { name, sha256: crypto.createHash('sha256').update(source).digest('hex'), source }; });
const head = execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim();
const pre = `begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local timezone='UTC';
select pg_advisory_xact_lock(20261016,77);
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $preflight$
declare locked_table record;
begin
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20261016130432' and name='preview_password_sessions')
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20261005140439' and name='season_division_model')
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20261005140504' and name='edition_creation_workflow') then raise exception 'Migration baseline mismatch'; end if;
 if exists(select 1 from supabase_migrations.schema_migrations where version > '20261005140504' and version <> '20261016130432') then raise exception 'Unexpected applied migration'; end if;
 for locked_table in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' order by 1,2 loop
  execute format('lock table %I.%I in share row exclusive mode',locked_table.nspname,locked_table.relname);
 end loop;
 if exists(select 1 from public.competition_seasons group by series_id,year having count(*)>1) then raise exception 'Consolidation would delete existing seasons'; end if;
 if exists(select 1 from public.competition_competitive_division_types group by season_id having count(*)>1) then raise exception 'Consolidation would delete existing division types'; end if;
 if exists(select 1 from public.competition_competitive_division_values group by season_id,slug having count(*)>1) then raise exception 'Consolidation would delete existing division values'; end if;
 if exists(select 1 from public.team_registrations r join public.teams t on t.id=r.team_id where t.name<>btrim(t.name) or char_length(t.name) not between 2 and 120) then raise exception 'Invalid registration name'; end if;
 if exists(select 1 from public.team_registrations r join public.teams t on t.id=r.team_id group by r.competition_id,lower(t.name) having count(*)>1) then raise exception 'Registration name collision'; end if;
end $preflight$;
create temporary table rollout_before(schema_name text,table_name text,row_count bigint,row_hash text) on commit drop;
create function pg_temp.rollout_inventory() returns table(schema_name text,table_name text,row_count bigint,row_hash text) language plpgsql as $inventory$
declare t record; expr text;
begin
 for t in select b.schema_name,b.table_name from rollout_before b order by 1,2 loop
  expr := 'to_jsonb(r)';
  if t.schema_name='public' and t.table_name='competition_seasons' then expr := expr || ' - ''gender_division'' - ''dispute_navigation_order'''; end if;
  if t.schema_name='public' and t.table_name='team_registrations' then expr := expr || ' - ''public_name'' - ''updated_at'''; end if;
  return query execute format('select %L::text,%L::text,count(*),md5(coalesce(string_agg(h,'''' order by h),'''')) from (select md5((%s)::text) h from %I.%I r) q',t.schema_name,t.table_name,expr,t.schema_name,t.table_name);
 end loop;
end $inventory$;
insert into rollout_before(schema_name,table_name) select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r';
create temporary table rollout_captured on commit drop as select * from pg_temp.rollout_inventory();
update rollout_before b set row_count=c.row_count,row_hash=c.row_hash from rollout_captured c where b.schema_name=c.schema_name and b.table_name=c.table_name;
create temporary table rollout_auth_before on commit drop as select p.oid,md5(pg_get_functiondef(p.oid)) definition_hash,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('is_current_admin_aal2','admin_open_preview_session','admin_close_preview_session')) or (n.nspname='private' and (p.proname='is_admin_aal2' or p.proname like '%preview%'));
create temporary table rollout_membership_before on commit drop as select r.id from public.team_registrations r where private.registration_is_currently_published(r.id);
do $membership_pre$ begin
 if (select count(*) from rollout_membership_before) <> (select count(distinct m.registration_id) from private.competition_publication_registrations m join public.competitions c on c.id=m.competition_id and c.current_publication_id=m.publication_id where c.status in ('published','archived')) then raise exception 'Preflight published membership mismatch'; end if;
end $membership_pre$;
create temporary table rollout_security_before on commit drop as select c.oid,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r';
`;
const post = `
do $reconcile$
begin
 if exists(select 1 from rollout_before b full join pg_temp.rollout_inventory() a using(schema_name,table_name) where b.row_count is distinct from a.row_count or b.row_hash is distinct from a.row_hash) then raise exception 'Domain data reconciliation failed: %',(select jsonb_agg(jsonb_build_object('table',b.schema_name||'.'||b.table_name,'before_count',b.row_count,'after_count',a.row_count)) from rollout_before b full join pg_temp.rollout_inventory() a using(schema_name,table_name) where b.row_count is distinct from a.row_count or b.row_hash is distinct from a.row_hash); end if;
 if exists(select 1 from rollout_auth_before b left join pg_proc p on p.oid=b.oid where md5(pg_get_functiondef(p.oid)) is distinct from b.definition_hash or p.proacl::text is distinct from b.acl) then raise exception 'Auth helper drift'; end if;
 if exists((select id from rollout_membership_before except select id from public.team_registrations r where private.registration_is_currently_published(r.id)) union all (select id from public.team_registrations r where private.registration_is_currently_published(r.id) except select id from rollout_membership_before)) then raise exception 'Published registration membership drift'; end if;
 if exists(select 1 from public.team_registrations r join public.teams t on t.id=r.team_id where r.public_name is distinct from t.name) then raise exception 'Registration backfill mismatch'; end if;
 if exists(select 1 from public.team_registrations where updated_at is distinct from transaction_timestamp()) then raise exception 'Registration metadata backfill mismatch'; end if;
 if exists(select 1 from public.competition_seasons where dispute_navigation_order<>'category_division') then raise exception 'Navigation default mismatch'; end if;
 if exists(select 1 from rollout_security_before b left join pg_class c on c.oid=b.oid where b.relrowsecurity is distinct from c.relrowsecurity or b.relforcerowsecurity is distinct from c.relforcerowsecurity or b.acl is distinct from c.relacl::text) then raise exception 'Existing table security drift'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and (n.nspname='public' or (n.nspname='private' and not exists(select 1 from rollout_security_before b where b.oid=c.oid))) and not c.relrowsecurity) then raise exception 'Missing exposed or new private RLS'; end if;
 if has_table_privilege('anon','public.keyboard_scoresheets','INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.keyboard_scoresheets','INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.keyboard_scoresheet_revisions','INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.keyboard_scoresheet_revisions','INSERT,UPDATE,DELETE') then raise exception 'Keyboard direct write privilege'; end if;
end $reconcile$;
select jsonb_build_object('existing_tables_reconciled',(select count(*) from rollout_before),'published_members',(select count(*) from rollout_membership_before),'migrations_added',19,'auth_helpers_unchanged',true,'domain_hashes_unchanged',true) as rollout_result;
notify pgrst,'reload schema';
commit;
`;
const body = manifest.map((m,i) => `\n-- ${m.name} SHA256 ${m.sha256}\n${m.source}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${m.name.slice(0,14)}','${m.name.slice(15,-4)}',array[$history_${i}$${m.source}$history_${i}$]);\n`).join('');
fs.writeFileSync('tmp/rollout-atomic.sql',pre+body+post);
fs.writeFileSync('tmp/rollout-manifest.json',JSON.stringify({head,project:'yjnbemfeyjhxhomprlnm',migrations:manifest.map(({source,...m})=>m),sqlSha256:crypto.createHash('sha256').update(pre+body+post).digest('hex')},null,2)+'\n');
console.log(JSON.stringify({head,migrations:manifest.length,sqlBytes:Buffer.byteLength(pre+body+post),sqlSha256:crypto.createHash('sha256').update(pre+body+post).digest('hex')}));

```
