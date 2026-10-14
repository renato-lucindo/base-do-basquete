# PR #77 — Substituição da entrada de súmula pelo MVP de teclado (14/10/2026)

## Alteração visível

O endereço existente `/admin/competitions/:competitionId/scoresheets/new` deixou de renderizar a grade legada por períodos, 2P, 3P, LL e faltas. Agora apresenta a seleção de jogos elegíveis ou redireciona automaticamente para `/admin/games/:gameId/scoresheet/keyboard` quando há apenas um. Apenas os jogos com confronto, duas inscrições confirmadas e elencos ativos são selecionáveis. Em prévias cujo banco não contenha `keyboard_scoresheets`, a tela apresenta um bloqueio explícito, preservando os dados e evitando prometer gravação inexistente.

O leitor prioriza `team_registrations.public_name` para identificar a inscrição (inclusive quando equipes compartilham `teams.id`), com fallback de leitura em esquemas antigos sem a coluna. Erros de permissão e erros de esquema não previstos continuam falhando. O editor novo, migração aditiva e fluxo de importação já existentes na PR foram preservados.

## Evidências

- HEAD funcional: `4a47f8bdee9cafbde34cb540ce4a006d49776d59`. Reconciliado com `b045850d927d8b8521fed96595a88c8793cc00ad`, que já integrava a main `be85121` com PRs #79/#73.
- `npm ci --no-fund` em worktree descartável do HEAD: 165 pacotes instalados, 166 auditados, zero vulnerabilidades; Wrangler 4.149.0 conforme lockfile.
- `npm run check` PASS: 550 Vitest (68 arquivos), formato, lint (328 avisos não bloqueantes), TypeScript, checks de documentação/agentes, build e scan de 753 arquivos.
- `npx playwright test e2e/keyboard-scoresheet.spec.ts` PASS: 9 cenários em Chromium. A fixture cobre foco/teclado, dualidade equipe/camisa, falta compensada, undo/edição, persistência simulada/recuperação e reflow 390/720/1440 em dois temas.
- Cloudflare Worker de preview versionado: `aa44872d-3d11-49fd-99b1-d9e4ca7abe8b`, alias `pr-77-base-do-basquete-preview.renato-lucindo-jr.workers.dev`, upload apenas de preview. `smoke:mvp` (segurança e privacidade) PASS; `smoke-public-context` PASS.

## REVIEW_PACKET incremental

WORK_UNIT: PR77-KEYBOARD-ENTRY-REPLACE

BRANCH: codex/keyboard-scoresheet-mvp

BASE_COMMIT: b045850d927d8b8521fed96595a88c8793cc00ad

HEAD_FUNCIONAL: 4a47f8bdee9cafbde34cb540ce4a006d49776d59

OBJETIVO: substituir definitivamente o editor antigo na inclusão manual, promovendo a transcrição por teclado em jogos elegíveis e compatibilidade de nomes por inscrição.

CRITERIOS_DE_ACEITE: rota antiga não renderiza grade; acesso ao editor novo; diferencia equipe/camisa; jogos sem elenco bloqueados; fallback específico para schema antigo; migration ausente bloqueia gravação com aviso.

ESCOPO: rota de entrada, testes, nomes de equipes no loader do teclado, reconciliação não destrutiva com main, documentação.

ESCOPO_NEGATIVO: nenhuma migração aplicada, sem alteração no editor legado ou importação FIBA/Site, sem merge para main, sem produção.

MIGRATIONS: nenhuma nova neste delta; a PR possui `20261013191057_keyboard_scoresheet_events.sql`, ainda sem rollout compartilhado.

RISK_LEVEL: CRITICO (integração de dados de jogo e contratos de inscrição entre versões de schema).

REQUIRED_REVIEWERS: database-security-reviewer, statistics-domain-reviewer, accessibility-ui-reviewer, qa-reviewer.

REVIEW_DECISIONS: todos REQUIRED no HEAD atualizado. Não reutilizar como aprovações válidas os pareceres do SHA anterior.

EVIDENCIAS: este documento, execução local e smoke de preview acima; histórico anterior em `docs/execution/KEYBOARD-SCORESHEET-MVP.md`.

AMBIENTE_VALIDADO: checkout descartável do código, fixture de navegador, Worker de preview com acesso público não autenticado.

RISCOS/PENDÊNCIAS: preview autenticado com persistência não validado; schema compartilhado pode não conter `public_name` ou as tabelas do teclado; GoTrue/PostgREST, pgTAP/migration no novo HEAD, CI/CodeQL e pareceres independentes pendentes. Até provar esses gates, manter PR DRAFT e release BLOCKED.

PROXIMO_PASSO_EXATO: habilitar CI/CodeQL, testar migração e persistência em PostgreSQL/GoTrue/PostgREST descartáveis, obter pareceres independentes no SHA exato e executar ensaio autenticado no preview com backend apto. Não executar migrations no Supabase compartilhado nem deploy de produção sem unidade de rollout autorizada.