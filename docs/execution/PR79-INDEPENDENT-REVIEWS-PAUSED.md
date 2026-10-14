# PR79 — checkpoint das revisões independentes

## Pausa autorizada

Solicitação explícita do responsável: preservar progresso, pausar execuções e programar retomada após o reset de 5 horas. Reset consultado: 14/10/2026 02:33:44 America/Araguaina (1791956024). Retomada única às 02:36 neste chat; automação `retomar-revis-es-pr79-e-pr73-ap-s-reset`. Nenhum reset extra consumido. Quatro revisores encerrados. Lock RELEASED; trabalho incompleto, sem merge.

## Código e evidências

- Repositório: `renato-lucindo/base-do-basquete`.
- Base: `f29d8ba620d8d64697874a7958f53f601671a63c`.
- PR79 branch: `codex/independent-registrations-copy`; HEAD funcional `676021c9a8da5e0ac78b38ac7bcbaacb69a80e65`.
- Branch do checkpoint: `codex/pr79-review-handoff`, checkout `C:/Users/12405304716/AppData/Local/Temp/base-pr79-review-handoff`.
- REVIEW_PACKET inicial: PR79 comentário6157258054; correções6158410355; último676021c no comentário6158529386.
- Commit28b9800: fingerprints legados, perfil por inscrição, slug antigo no montador, replay HTTP, matching SQL e regressões. Commit9deb996: somente linha vazia final da nova migration ainda não aplicada. Commit676021c: fallback do histórico com jogos e preservação de registrationId de snapshots antigos, mais3 regressões.
- `npm run check` final local PASS:486 Vitest/65 arquivos, format/lint/typecheck/runbooks/agentes/build/segredos;15 testes focais de perfil/rota/publicação PASS. Avisos de lint preexistentes. Tipo de Worker regenerado por typegen foi identificado e removido do delta local; nenhum trabalho alheio descartado.
- HEAD9deb996: [CI38492615854](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38492615854), [preview38492615976](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38492615976), [CodeQL38492616016](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38492616016) SUCCESS.45 arquivos/1271 pgTAP, upgrade publicado, concorrência e PostgREST PASS. Playwright9 pass/2 skips; os2cenários públicos executados no preview.
- HEAD676021c: [CI38493525222](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38493525222) gate/accessibility SUCCESS; database IN_PROGRESS na última consulta. [Preview38493525231](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38493525231) e [CodeQL38493525218](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38493525218) SUCCESS. Conferir banco ao retomar; não repetir gate local sem novo delta relevante.

## Pareceres efetivamente executados

Todos usaram instâncias independentes somente leitura, status limpo antes/depois, sem escrever versão, fazer migrations ou subagents. Basef29d8ba em todos. Pareceres iniciais4264dd2: banco/estatísticas/QA REQUEST_CHANGES, publicados nos comentários6158295042 e6158337714. Houve correções verificadas, mas nenhum APPROVE final.

Rodada9deb996:

- **statistics-domain-reviewer**, instância Anscombe, `01a137d5-6bcd-7a20-bbcf-8dcc157502cb`, REVIEWED_AT2026-10-14T00:57:24Z: REQUEST_CHANGES. Fingerprint legado e summaries migrados resolvidos. Restaram P2fallback public_name com jogos e P2link por inscrição em snapshot antigo.28 testes focais PASS. Esses dois caminhos foram corrigidos em676021c, mas ainda sem renovação do parecer.
- **database-security-reviewer**, Jason, `01a137d5-69f5-7a63-86a2-9e82af440828`, REVIEWED_AT2026-10-14T00:59:22Z: REQUEST_CHANGES pelo mesmo P2de rota legado. Os dois SQL aditivos, AAL2/grants/search_path/ownership/replay e correções próprias foram aprovados tecnicamente no domínio, sem converter isso em aprovação integral. Não repetiu o segundo P2estatístico. Renovar após correções e novo delta SQL futuro.
- **qa-reviewer**, Tesla, `01a137d6-2a4d-7a63-b0cb-77205ca7d3bc`, REVIEWED_AT2026-10-14T00:59:25Z: REQUEST_CHANGES/NOT_READY pelos mesmos dois P2, sem novo achado próprio. Confirmou retry HTTP/origem/MFA/CSRF e slug antigo sob identidade nova. Gates equivalentes à árvore exata auditados. QA precisa receber pareceres especializados válidos antes de READY.
- **boxscore-domain-reviewer**, Curie, `01a137e6-8494-7ad3-a329-c393dadb123e`, REVIEWED_AT2026-10-14T01:01:43Z: REQUEST_CHANGES por dois P2 ainda não corrigidos abaixo.40 testes/7arquivos PASS com PDFs FIBA/Basketball Site, bytes/geometria/matching/actions. Reproduções com corpos SQL reais em PostgreSQL em memória, schema reduzido e auth simulada; isso não substitui integração Supabase. Artefato efêmero `C:/Users/12405304716/AppData/Local/Temp/pr79-boxscore-pglite-9deb996/reproduce.mjs` permanece local, mas condições da reprodução estão registradas abaixo. Não tratar como dependência essencial única.

Não houve revisão do HEAD676021c: o pacote foi publicado, mas a pausa foi solicitada antes de iniciar essa renovação. Os REQUEST_CHANGES continuam bloqueantes. Não transportar aprovação entre SHAs materiais.

## Dois bloqueios de boxscore ainda abertos

1. `supabase/migrations/20261014004539_boxscore_registration_identity_contract.sql:206`: `register_existing_team` ainda compara nome global OU sigla, sem prioridade de nome público. Reprodução: PDF `Lobos B/LOB`, inscrição correta11; solicitação register_existing_team para `Ursos/LOB` retornou/persistiu20. Trigger de ambiguidade ativo, mas Ursos tinha uma inscrição só. Aplicar a mesma prioridade autoritativa também neste ramo; testar rejeição sem efeito parcial. `existing_registration` foi corrigido e não deve perder suas garantias.
2. Resolução A/B não chega ao commit final. Corpos legados em `20260824163802_wp14_import_team_stats_assisted_players.sql`: participantes linha568, placar linha790, `private.upsert_boxscore_statistics` linha205 ainda usam equipe global. FixtureFIBA ALC×AVA58–67, alterando só identidades: `Lobos A/LAA` e `Lobos B/LBB` resolve10/11, mas commit legado BD305; ambos siglaLOB: commit BD307; persistência coletiva A/B: BD310. Transportar associação por inscrição até participantes, placar e métricas, com regressão completa resolver→confirmar→persistir.

Migrations publicadas anteriores devem permanecer intactas; próxima correção deve ser aditiva. O antigo corpo de `private.admin_commit_boxscore_import_impl` foi renomeado em migrations posteriores: pesquisar `admin_commit_boxscore_import_without_eligibility`, `admin_commit_boxscore_import_with_eligibility_legacy_game`, `admin_commit_boxscore_import_post01_base` e wrappers antes de substituir qualquer corpo. O helper `upsert_boxscore_statistics` é chamado tanto no commit quanto no refresh; preservar ambas as trilhas, perfis, submissões, autoridade e matching dos dois formatos suportados. Não alterar parser ou contrato genérico para contornar o erro.

## Restrições e sequência

- Nenhum merge realizado. PR79 e PR73 draft. PR77 intocada (`1df666858180d652f103eff5c182fb0c1d0ebb91` na consulta).
- PR73 não revisada nesta sessão. HEADf3b1a5ddb426a0edd1a40bd6c445f2721945238a; base4264dd2. Packet6157258955; exige database-security/accessibility-ui/QA. A análise prévia merge-tree contra9deb996 apontou somente conflito HANDOFF, mas reconfirmar após próximos commits.
- Supabase compartilhado: nenhuma mutação. Inventário read-only do revisor7temporadas/9disputas/20inscrições; public_name ainda ausente. MigrationsPR66 remotas20261005140439/20261005140504: não reaplicar por timestamps diferentes, nem dbpush/repaircego.
- Sem produção. Workflow produtivo manual-only; não acionar. Smoke GoTrue/MFA real pendente para rollout; pgTAP usa claims simuladas e testePostgREST atual usaJWTnãoadmin. Isso foi separado do merge sem deploy explicitamente autorizado, mas não dispensa os bloqueios funcionais.
- `main` sem proteção configurada (API404): gates manuais completos obrigatórios; não alterar configuração nesta unidade.
- Checkout originaldbecf54 e `app/modules/manual-scoresheet-engine/` não rastreado preservados; demais worktrees também. Não limpar, resetar ou descartar.

## Próximo passo exato

Após o reset, consultar limites e CI676021c. Reassumir lock na unidade focal, corrigir os dois P2de boxscore em migration aditiva, acrescentar regressão de ponta a ponta e executar gates. Publicar packet novo e obter pareceres independentes de banco, estatísticas, boxscore e QA no SHAexato. Somente sem bloqueios integrarPR79. Depois retargetar/reconciliarPR73 com main, atualizar packet, executar seus gates e revisores obrigatórios; integrar somente se aprovados. Não alterarPR77, banco compartilhado ou produção.
