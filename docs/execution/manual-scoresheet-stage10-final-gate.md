# PR #72 — pacote final da Etapa 10

Data: 12/10/2026, America/Araguaina. Este documento substitui o esboço de8365534. O fechamento documental e o aceite funcional não autorizam merge ou rollout.

## Identidade e contrato

```text
REVIEW_PACKET:
WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE10-GATE
BRANCH: codex/manual-stage4-v3-review; destino origin/codex/manual-scoresheet-v2
BASE_COMMIT: 84f4510083a4c684f99193be9916530c391d4e15 (base documental da Etapa10)
HEAD_COMMIT: fixado no comentário REVIEW_PACKET publicado após commit deste documento
BASE_MAIN: 27d917a1ce4a404ced091fd3ca660113c215ca92
ARTEFATO_FUNCIONAL: 80a33355d98dc351214d825557323fa29ebf957b
OBJETIVO: consolidar evidências, validade dos pareceres, condições de integração e recuperação
CRITERIOS_DE_ACEITE: packet publicado com SHA exato, delta documental validado, pareceres rastreáveis e estado remoto real registrado
ESCOPO: documentação/evidências, revisão incremental e publicação na PR72
ESCOPO_NEGATIVO: código, dependências, workflows, migrations compartilhadas, merge/main e produção
ARQUIVOS_ALTERADOS: HANDOFF.md; este relatório; manual-scoresheet-stage10-followups.md
MIGRATIONS: nenhuma criada/alterada nesta unidade; seis pendentes da feature abaixo
RISCOS_CONHECIDOS: cobrança GitHub; baseline compartilhada divergente; script de prévia desatualizado; avisos DEV; homologação autenticada pendente
TESTES_EXECUTADOS: gates da seção seguinte; validação documental incremental registrada no fechamento
EVIDENCIAS: links e relatórios abaixo
AMBIENTE_VALIDADO: PostgreSQL descartável no Actions; QA local Windows; preview Cloudflare do artefato funcional
RISK_LEVEL: CRITICO na feature; BAIXO no delta documental
RISK_JUSTIFICATION: persistência crítica e autoridade estatística já revisadas; delta não muda comportamento
REVIEW_DECISIONS: banco/estatística/acessibilidade REQUIRED, pareceres por domínio preservados; QA REQUIRED, reconciliação incremental
REQUIRED_REVIEWERS: database-security-reviewer, statistics-domain-reviewer, accessibility-ui-reviewer, qa-reviewer
WAIVERS: sem nova revisão profunda de banco/estatística/UI para delta exclusivamente documental; sem dispensa dos pareceres críticos existentes; boxscore/performance não afetados
REVIEW_APPROVER: project-maintainer
WRITE_LOCK_OWNER: project-maintainer
```

O SHA documental completo é publicado na PR para evitar referência circular ao commit que contém este documento. Conferir `git diff --name-only 80a3335 HEAD`: somente HANDOFF, relatórios e logs. Nenhum resultado de outro SHA é atribuído ao head documental. O contrato permite reutilizar pareceres por domínio quando o artefato não muda.

## Gates e ambientes

| Evidência | Artefato / resultado | Limite |
| --- | --- | --- |
| [CI38292700529](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700529) | 80a3335, SUCCESS; gate/database/accessibility/upgrade | Banco descartável |
| pgTAP no CI | 49 arquivos/1.418 assertivas; revisões66; histórico9 arquivos/355 assertivas; concorrência real PASS | Não prova equivalência integral aos dados compartilhados |
| [Preview38292700402](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700402) | 80a3335, SUCCESS; smokes e acessibilidade pública | Escrita autenticada no schema compartilhado não homologada |
| [CodeQL38292700390](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700390) | 80a3335, SUCCESS | Sem nova análise atribuída ao SHA documental |
| [Stage4 original](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292694151) | SQL/concorrência/histórico SUCCESS; QA não iniciou por cobrança; integração SKIPPED | Run global FAILURE |
| [QA local autorizado](manual-scoresheet-stage9-local-qa.md) | 5e4badf, mesmo artefato funcional; check67 arquivos/564 testes; E2E35 PASS/1 SKIP esperado | Cenário público já passou no preview; não é auditoria manual integral de WCAG |
| Audit produção local | EXIT0, zero vulnerabilidades | Seis pacotes high DEV em acompanhamento separado |
| Integração atual read-only | main27d917a1 + HEAD8365534, merge-tree EXIT0, árvore2632dbff63042f7d6005a61fb6a3b0c9f01dc52b | Sem merge; repetir se base/delta material mudar |
| [Checks do head84f4510](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38297408269) | CI/CodeQL/Preview/Stage4 FAILURE ou SKIPPED | Annotation GitHub confirma jobs não iniciados por cobrança; não é SUCCESS |

Logs completos sanitizados: [check](evidence/manual-scoresheet-stage9-local-qa/npm-check.log), [E2E](evidence/manual-scoresheet-stage9-local-qa/playwright.log), [audit produção](evidence/manual-scoresheet-stage9-local-qa/npm-audit-production.json). A execução local foi escolhida expressamente pelo responsável e aceita por QA independente para a Etapa9; não remove branch protection nem substitui automaticamente os gates remotos de merge/release.

## Reconciliação dos pareceres

| Domínio / agente | Commit e data do parecer | Resultado vigente |
| --- | --- | --- |
| Banco Harvey01a1316d-b10c-7db2-b4f9-377dab45dec0 | 80a3335;2026-10-12T18:49:38Z | APPROVE_WITH_NON_BLOCKING_NOTES; revoga achados inativo/arquivado |
| Estatística Schrodinger01a1316d-b262-7461-b32d-76b8a453f4c7 | 80a3335;2026-10-12T15:49:54-03:00 | APPROVE_WITH_NON_BLOCKING_NOTES; revoga bloqueio de atleta histórico |
| Acessibilidade Hegel01a1316e-e843-77c0-aee5-53dc3f050eb0 | 80a3335;2026-10-12T15:49:05-03:00 | APPROVE_WITH_NON_BLOCKING_NOTES; revoga checkbox/foco/nomes; execução própria4/4 |
| QA Archimedes01a1316e-e9d2-7681-8088-18a92e500f46 | 5e4badf;2026-10-12T19:21:06Z | APPROVE_WITH_NON_BLOCKING_NOTES para Etapa9; revoga bloqueio operacional após QA local autorizado |

Relatórios integrais: [especialistas e histórico QA](manual-scoresheet-stage9-final-review.md), [renovação QA](manual-scoresheet-stage9-local-qa.md). Etapas anteriores permanecem rastreáveis nas seções3–32 do HANDOFF; os deltas da Etapa9 foram cobertos por novos pareceres, sem usar aprovação antiga para autorizar alteração posterior. A revisão incremental da Etapa10 será registrada com SHA/data/resultados reais. Não alegar aprovação de merge por herança.

## Migrations e preflight futuro

Última consulta compartilhada registrada pelo revisor de banco em12/10: migration20261005140504; não foi feita nova consulta nesta etapa. Manifesto histórico em [inventário](supabase-stage4-remote-migration-history.json). Antes de aplicar, comparar novamente histórico, SQL, contagens e advisors de modo read-only. Há diferenças históricas conhecidas; não executar push genérico da pasta local nem repair em massa.

Ordem das seis migrations pendentes, sem modificações nesta etapa:

1. `20261006223000_manual_scoresheet_v2.sql` — persistência semântica/metadados.
2. `20261007161000_manual_scoresheet_v2_atomic_create.sql` — criação transacional.
3. `20261008090000_manual_scoresheet_v2_revisions.sql` — revisões/CAS/auditoria.
4. `20261008140000_manual_scoresheet_v2_collective_ft_public_projection.sql` — projeção coletiva de LL.
5. `20261012113000_manual_scoresheet_v2_ot_disqualification.sql` — OT/desqualificação.
6. `20261012174500_manual_scoresheet_v2_revision_guards.sql` — autoridade por domínio/inativos/arquivamento.

**Preflight ainda NOT_READY:** `scripts/supabase-stage4-reconcile-overlay.mjs` lê as seis entradas do manifesto, mas mantém `created.length === 66` e mensagem de quatro pendentes. Com62 aplicadas+6 pendentes, o resultado esperado é68; o script para antes de imprimir o dry-run. O problema foi identificado por inspeção, sem executar DDL/DML. Corrigir e validar em unidade própria antes do preflight, com teste de manifesto e revisão proporcional; não usar o procedimento antigo que cita quatro migrations. O overlay de reconstrução histórica usado no CI é uma evidência distinta deste gerador de prévia.

## Sequência de integração e rollout — planejada, não executada

1. Resolver capacidade dos Actions e obter checks obrigatórios válidos no SHA a integrar, mantendo proteção da main. Reconciliar base atual e renovar somente os domínios afetados por mudanças materiais. Manter PR OPEN/DRAFT até gate de integração satisfeito.
2. Corrigir o preflight acima; conferir inventário remoto atualizado e preparar plano que proponha exatamente as seis migrations, na ordem listada. Preservar versões históricas e registrar hashes do SQL efetivamente aprovado. Qualquer diferença inesperada interrompe a aplicação.
3. Em ambiente isolado representativo, ensaiar atualização com dados de teste, RLS/anon/AAL1/AAL2, compatibilidade da aplicação anterior com schema novo e da aplicação nova com schema novo. Registrar backup recuperável e ensaio de recuperação. Os testes descartáveis verdes já existentes não comprovam essa compatibilidade operacional compartilhada.
4. Na unidade de rollout autorizada, aplicar primeiro o schema aprovado, sob controle de escritas administrativas, sem publicar a nova aplicação antes da última migration. Reconciliar histórico/grants/advisors, contagens e fatos por domínio após cada aplicação. Em falha, parar e preservar estado; migrations são arquivos separados, não uma transação global presumida.
5. Homologar preview com schema atualizado: login/MFA AAL2, criar jogo+súmula, retry idêntico, revisão/CAS, inativo histórico permitido, novo inativo negado, arquivada negada, OT após empate/período concluído, histórico/auditoria e leitura pública sem vazamento. Usar dados de homologação e registrar limpeza autorizada.
6. Integrar pela main protegida somente com gates satisfeitos. Conforme [release-candidate](../runbooks/release-candidate.md), gerar candidata sem tráfego com o workflow Bootstrap Worker deploy, environment=production/release_mode=upload-candidate; registrar SHA/tag/ID e versão saudável anterior. Promover somente após compatibilidade e smokes. Validar health/headers/público/MFA/auditoria e benchmark aplicável após publicação.

A preparação do schema e a homologação precedem a ativação da nova aplicação. Merge e aplicação compartilhada pertencem à próxima unidade operacional, não a esta entrega. O workflow de produção é manual e restrito à main; nenhum dispatch foi executado.

## Recuperação e rollback

- Antes de aplicar: preservar versão saudável do Worker, inventário/SQL/hashes, backup verificado e fatos de referência; não coletar credenciais nos logs.
- Falha de migration: interromper a sequência, identificar arquivos já commitados no banco e reconciliar efeitos. Não excluir registros de histórico nem desfazer snapshots/auditorias. Preparar correção aditiva, testar no isolado e renovar revisão de banco.
- Regressão de aplicação: manter ou restaurar a versão saudável somente se compatível com o schema resultante. Seguir [rollback](../runbooks/rollback.md); rollback do Worker não reverte Supabase, dados, Storage ou migrations. Se incompatível, manter escritas suspensas e preparar correção progressiva.
- Após recuperação: conferir versão ativa, health, público, MFA AAL2, criar/revisar/retry/CAS, histórico imutável, auditoria e autoridades. Preservar evidências por correlationId, sem payload privado. Restauração destrutiva exige backup validado e intervenção humana conforme AGENTS.

## Readiness e continuidade

Aceite funcional da Etapa9: preservado. Pacote documental da Etapa10: aguardando publicação/revisão incremental. **Merge/rollout: NOT_READY**, por checks remotos não aprovados, preflight desatualizado e homologação/recuperação compartilhadas ainda pendentes. Isso não reabre testes funcionais já aprovados nem transforma falha de cobrança em falha de código.

Acompanhamentos separados e critérios: [manual-scoresheet-stage10-followups.md](manual-scoresheet-stage10-followups.md).
