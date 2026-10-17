# PR #77 — Correções dos pareceres críticos (14/10/2026)

REVIEW_PACKET:

- WORK_UNIT: PR77-CRITICAL-REVIEW-FIXES
- OWNER: project-maintainer
- BRANCH_REMOTA: codex/keyboard-scoresheet-mvp
- BASE_COMMIT: cc32c703adcf0fbc1776e5a89453ebed09cc7940
- HEAD_COMMIT: commit desta unidade, a confirmar no GitHub antes de solicitar pareceres
- OBJETIVO: eliminar os bloqueios de estatísticas e acessibilidade identificados na PR #77, sem antecipar rollout.
- CRITERIOS_DE_ACEITE: uma desqualificação por GD/D no modelo público; totais públicos por inscrição; mensagens de erro vinculadas ao campo inválido, com foco correto; regressões em SQL e navegador.
- ESCOPO: projeções públicas de súmula em migration aditiva, pgTAP do editor por teclado, editor React, fixture e Playwright.
- ESCOPO_NEGATIVO: migrations anteriores imutáveis, Supabase compartilhado, produção, PR #72, outras branches e worktrees.
- MIGRATIONS: 20261014180500_keyboard_public_player_statistics.sql (nova, aditiva; exige aplicação no banco descartável do CI).
- RISK_LEVEL: CRITICO.
- REQUIRED_REVIEWERS: database-security-reviewer, statistics-domain-reviewer, accessibility-ui-reviewer, qa-reviewer.

## Implementação e evidência

- Projeção por jogo: conta GD (2T, 2U, T+U, 2C, 3BC e PLAYER_COACH) pelo estado autoritativo de desqualificação do slot, mantendo D direto. Os dados indisponíveis quando não existe domínio de cronologia de faltas continuam nulos.
- Projeção por competição: agrega por `competition_id + player_id + registration_id`, vinculando equipe, camisa e posição à inscrição correspondente. Uma transferência preserva estatísticas históricas separadas.
- O editor agora foca a segunda camisa duplicada e vincula erro com `aria-invalid`/`aria-describedby`; o campo de ação tem marcação independente do número da camisa; revisão confirmada exige motivo de pelo menos 10 caracteres, foca o textarea e associa o aviso.
- Novos pgTAP cobrem GD acumulado, D direto, isolamento de atleta transferido e equipe da inscrição, em transação com rollback. **Ainda não executados localmente**: Docker ausente; aguardar CI PostgreSQL descartável.
- `npx playwright test e2e/keyboard-scoresheet.spec.ts --project=chromium --workers=2`: **12/12 PASS**, inclusive três regressões novas; Chromium instalado localmente para o ensaio.
- `npm run check`: **PASS**, 550 Vitest/68 arquivos; formato Biome, lint (328 avisos pré-existentes), typecheck, runbooks, contrato de agentes, build e scan de 755 arquivos.

## Bloqueios para merge/release

Mesmo com checks verdes, são obrigatórios: pgTAP e upgrade integral do SQL no CI do novo commit, quatro pareceres independentes válidos no HEAD atualizado, smoke autenticado GoTrue/PostgREST AAL2 e concorrência com escritores alternativos em ambiente isolado. Preview público com fixture não comprova fluxo autenticado. Manter PR como DRAFT até todos os requisitos serem comprovados. Não executar migration em Supabase compartilhado ou deploy de produção nesta unidade.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; SERVICO=PR #77 / checks e revisores; ACAO=publicar branch, verificar database/CI/CodeQL/preview no SHA remoto, colher quatro pareceres independentes e executar ensaio isolado GoTrue/PostgREST AAL2 e concorrência entre escritores; CRITERIO_DE_CONCLUSAO=todos gates comprovados e nenhum REQUEST_CHANGES vigente antes de avaliar integração, sem mutação do ambiente compartilhado.
