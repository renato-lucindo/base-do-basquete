# PR #72 — Etapa 9: pareceres finais e evidências

Artefato funcional: `80a33355d98dc351214d825557323fa29ebf957b`. Base da Etapa 9: `98212482e4c316ba0517df70fa9e2d9696f79641`.

Estado consolidado em 12/10/2026: correções funcionais verificadas, três especialistas aprovam com ressalvas não bloqueantes; QA mantém BLOCK_RELEASE pelo Stage4 incompleto. O GitHub recusou iniciar QA nas duas tentativas por cobrança/limite de gastos; integração remota foi SKIPPED. Sem dispensa ou redução do gate. Etapa 9 permanece aberta; Etapa 10 não iniciada.

CI `38292700529`, Preview `38292700402` e CodeQL `38292700390`: SUCCESS no artefato acima. Stage4 `38292694151`: pgTAP/concorrência e reconstrução histórica SUCCESS, QA FAILURE antes de iniciar, integração SKIPPED. Integração local read-only `git merge-tree --write-tree origin/main HEAD` PASS contra main `27d917a1ce4a404ced091fd3ca660113c215ca92`, tree `f8e111c1dea734a7ae3f9e555f762238d3fa4269`; isso não substitui job obrigatório.

Os pareceres abaixo são relatórios independentes recebidos via agentes, preservados integralmente. Referem-se ao artefato funcional, sem aplicação no banco compartilhado ou autorização de merge/produção.

## Banco e segurança — Harvey

Agente: `01a1316d-b10c-7db2-b4f9-377dab45dec0`.

PARECER: **APPROVE_WITH_NON_BLOCKING_NOTES**  
WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE9-REVISION  
BASE_COMMIT: 98212482e4c316ba0517df70fa9e2d9696f79641  
COMMIT_REVISADO: 80a33355d98dc351214d825557323fa29ebf957b  
REVIEWED_AT: 2026-10-12T18:49:38Z

ESCOPO_REVISADO: delta `c6fed91..80a3335`, no contexto da Etapa9/base informada e do [REVIEW_PACKET exato](https://github.com/renato-lucindo/base-do-basquete/pull/72#issuecomment-6130424575).

MIGRATIONS: correção aditiva `20261012174500`; migrations anteriores preservadas. Consulta read-only ao compartilhado confirmou última aplicada `20261005140504`; `revision_guards` permanece pendente.

RLS_E_GRANTS: AAL2 obrigatório na RPC e no writer privado; `search_path=''`; helper sem EXECUTE para PUBLIC/anon/authenticated. RPC preserva EXECUTE de authenticated e nega PUBLIC/anon. Nenhuma ampliação de acesso às tabelas.

INTEGRIDADE_E_TRANSACOES: inativo permitido somente quando consta do snapshot imutável da submissão manual anterior ainda ativa, no mesmo jogo, inscrição e lado. Competição arquivada rejeitada dentro da RPC com `BR032` e `FOR SHARE`, que bloqueia atualização concorrente enquanto a transação permanece aberta ([PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html)). CAS, hash, identidade, snapshots, auditoria e seis autoridades permanecem transacionais; `games.source` deixou de ser condição de autorização.

PRIVACIDADE: sem nova exposição de dados privados ou credenciais; histórico administrativo protegido e loader com `private, no-store`.

TESTES_E_EVIDENCIAS:

- Execução própria: **17/17 Vitest PASS**, `node --check` e `git diff --check` PASS.
- [CI](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700529) **SUCCESS** no SHA fixo: gate, database, accessibility e upgrade histórico.
- Logs de CI/Stage4: **49 arquivos/1.418 asserções pgTAP PASS**, incluindo as **66** de revisões; upgrade histórico **9 arquivos/355 asserções PASS**.
- Concorrência real PASS: retry idêntico cria uma versão/uma auditoria; revisões divergentes produzem um vencedor/um conflito CAS, preservando histórico e seis autoridades.
- [Preview](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700402) e [CodeQL](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700390) SUCCESS.

ACHADOS: nenhum novo bloqueante no domínio revisado. **Revogo explicitamente o REQUEST_CHANGES anterior de Tesla quanto ao P1 de atleta histórico inativo e ao P2 de competição arquivada**: ambos corrigidos e verificados por pgTAP. Esta revogação não substitui pareceres de outros domínios.

RISCOS_RESIDUAIS: Stage4 permanece FAILURE após nova tentativa: QA não iniciou por restrição de faturamento/limite da conta; integração foi SKIPPED. Banco e upgrade passaram. Essa pendência operacional impede considerar o gate completo encerrado. Advisors e ensaio com dados reais permanecem fora desta revisão; reconstrução histórica valida schema, não clone integral.

GIT_STATUS_ANTES: limpo.  
GIT_STATUS_DEPOIS: limpo; HEAD inalterado. Nenhuma mutação versionada ou remota.

SKILL_RESULT:  
SKILL: reviewing-supabase-changes  
STATUS: PASS  
HEAD_COMMIT: 80a33355d98dc351214d825557323fa29ebf957b  
GATES_OMITTED: repetição do gate completo local, advisors e aplicação compartilhada.

PROXIMO_PASSO_EXATO:  
RESPONSAVEL: project-maintainer  
ARQUIVO_OU_SERVICO: PR72 / Stage4 Validation / HANDOFF  
ACAO: registrar este parecer, resolver a restrição operacional dos Actions e concluir QA/integração e demais revisões obrigatórias.  
CRITERIO_DE_CONCLUSAO: gates completos verdes e quatro pareceres válidos no SHA aplicável. Esta aprovação especializada não autoriza merge, migration compartilhada ou produção.

## Estatística — Schrodinger

Agente: `01a1316d-b262-7461-b32d-76b8a453f4c7`.

**APPROVE_WITH_NON_BLOCKING_NOTES — parecer estatístico independente.**

```text
WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE9-REVISION
BASE_COMMIT: 98212482e4c316ba0517df70fa9e2d9696f79641
COMMIT_REVISADO: 80a33355d98dc351214d825557323fa29ebf957b
REVIEWED_AT: 2026-10-12T15:49:54-03:00
```

Revogo o **REQUEST_CHANGES estatístico anterior de Faraday**, referente ao P1 de atleta histórico inativo. A migration `20261012174500` permite preservar o inativo somente quando ele consta do snapshot da submissão manual ativa do mesmo jogo, equipe e lado. Novos inativos continuam rejeitados. As regressões pgTAP verificam ambos os casos e a preservação do histórico.

No delta `c6fed91..80a3335`, contextualizado desde `9821248`, confirmei:

- **Autoridades:** revisão exige os seis domínios apontando para a base ativa; `games.source` deixou de determinar autorização. CAS e hash impedem sobrescrita de versão desatualizada.
- **Histórico/publicação:** snapshots anteriores permanecem imutáveis. Notas ou penalidades alteradas exigem republicação; a projeção coletiva acompanha a nova submissão.
- **Pontos:** `2 × 2PC + 3 × 3PC + LLC`, somados por atleta, equipe e período. OT exige empate acumulado anterior; empate final é rejeitado.
- **Faltas/LL:** Q4 e OT preservam o grupo único de faltas, com pontuação separada. GD em Q1–Q3 bloqueia pontos posteriores. LL cobrados derivam das penalidades adversárias; LL% coletivo usa convertidos/cobrados e fica indisponível quando cobrados são zero.
- **Arquivamento:** a RPC agora rejeita edição arquivada transacionalmente, com regressão passando. Isso não substitui a renovação do parecer de banco/QA.

Evidências verificadas:

- Execução própria: **116 testes focais PASS**, em 11 arquivos; `git diff --check` e verificação sintática do script PASS.
- [Stage4](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292694151): **49 arquivos/1.418 asserções pgTAP PASS**; concorrência real de retry e CAS PASS; reconstrução histórica **9 arquivos/355 asserções PASS**.
- [CI](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700529): gate, database, accessibility e remote_history_upgrade SUCCESS.
- [Preview](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700402) e [CodeQL](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700390): SUCCESS no SHA fixado.

**Pendência global:** o [QA Stage4](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292694151/job/114958531923) falhou antes de iniciar, por restrição de faturamento/limite de gastos informada pelo GitHub; Integration ficou SKIPPED. Esta aprovação estatística **não dispensa esse gate nem autoriza merge/release**.

```text
SKILL_RESULT:
SKILL: validating-basketball-statistics
STATUS: PASS
SCOPE: Etapa9; delta corretivo e efeitos estatísticos
HEAD_COMMIT: 80a33355d98dc351214d825557323fa29ebf957b
EVIDENCE: código, testes e Actions acima
GATES_RUN: 116 testes focais; diff check; sintaxe
GATES_OMITTED: suíte integral local, banco compartilhado e Playwright local
FINDINGS: P1 anterior resolvido; nenhum novo bloqueante estatístico
RESIDUAL_RISKS: gate global Stage4 incompleto
NEXT_ACTION: mantenedor registrar parecer e resolver gate pendente
```

Git limpo antes e depois; nenhuma mutação versionada ou remota.

**PROXIMO_PASSO_EXATO:** `project-maintainer`, na PR #72/Actions, registrar este parecer, resolver a indisponibilidade do QA Stage4 e confirmar QA/Integration e demais pareceres válidos antes de encerrar a Etapa9.

## Acessibilidade — Hegel

Agente: `01a1316e-e843-77c0-aee5-53dc3f050eb0`.

**APPROVE_WITH_NON_BLOCKING_NOTES — parecer renovado.**

```text
WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE9-REVISION
BASE_COMMIT: 98212482e4c316ba0517df70fa9e2d9696f79641
COMMIT_REVISADO: 80a33355d98dc351214d825557323fa29ebf957b
REVIEWED_AT: 2026-10-12T15:49:05-03:00
```

Confirmei os resultados remotos. Os dois replays históricos agora estão **SUCCESS**, assim como Stage4 Security/statistics, CI gate/database/accessibility, Preview e CodeQL. PR permanece OPEN/DRAFT, MERGEABLE no SHA indicado.

Há uma pendência nova: [QA Stage4, job 114958531923](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292694151/job/114958531923) terminou FAILURE **sem iniciar**, por restrição de faturamento/limite de gastos informada pelo GitHub. Integration ficou SKIPPED. Isso mantém o gate consolidado incompleto; não apresenta evidência de regressão de acessibilidade.

**Permanece expressamente revogado o REQUEST_CHANGES de Nietzsche:** os três P2 — associação do erro ao checkbox, foco no título ao trocar versão e identificação legível das faltas — continuam resolvidos. Preservada a evidência independente local **Playwright 4/4 PASS**, com as lacunas anteriormente registradas sobre fixture, zoom nativo e inspeção manual.

```text
SKILL_RESULT: validating-accessibility-ui
STATUS: PASS
SCOPE: renovação incremental das evidências remotas no mesmo SHA
GATES_RUN: consultas read-only de jobs, annotations, PR e Git
GATES_OMITTED: testes/build/SQL, sem mudança do artefato
FINDINGS: nenhum novo bloqueante de acessibilidade
RESIDUAL_RISKS: QA Stage4 não executado; lacunas focais preservadas
NEXT_ACTION: concluir QA Stage4 e consolidar demais pareceres
```

Git limpo antes/depois; nenhum arquivo ou serviço alterado.

**Próximo passo exato:** project-maintainer registrar a renovação na PR #72/HANDOFF e concluir QA Stage4 após regularização da capacidade de execução, além dos demais pareceres requeridos, antes de encerrar a Etapa 9.

## QA — Archimedes

Agente: `01a1316e-e9d2-7681-8088-18a92e500f46`.

**PARECER: BLOCK_RELEASE** — os três achados anteriores de QA estão resolvidos; o fechamento permanece bloqueado por pendências do gate e dos pareceres obrigatórios.

```text
WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE9-REVISION
BASE_COMMIT: 98212482e4c316ba0517df70fa9e2d9696f79641
COMMIT_REVISADO: 80a33355d98dc351214d825557323fa29ebf957b
REVIEWED_AT: 2026-10-12T18:49:34Z
ESCOPO: renovação QA independente, integração e evidências
GIT_STATUS_ANTES: limpo
GIT_STATUS_DEPOIS: limpo
```

**Resolução dos achados anteriores de Sagan:**

- **P1 — atleta inativo: resolvido no domínio QA.** Contexto preserva o atleta histórico; a RPC admite inativo presente no snapshot ativo anterior, na mesma equipe/lado. pgTAP cobre preservação desse atleta e rejeição de novo inativo.
- **P1 — competição arquivada: resolvido no domínio QA.** Loader mantém consulta somente; RPC verifica o estado sob lock transacional. Regressões cobrem rejeição `BR032`, histórico preservado e resposta acessível da action.
- **P2 — concorrência: resolvido.** O harness usa conexões independentes e exige ambas bloqueadas antes de liberar a barreira. Retry idêntico produz uma revisão; CAS divergente produz um vencedor e um conflito, verificando versões, auditorias, seis autoridades e conteúdo vencedor. Execução real confirmada em CI e Stage4.

Esses três achados deixam de sustentar o `REQUEST_CHANGES` anterior de QA. **Não identifiquei novo defeito funcional bloqueante no escopo revisado.**

**Evidências verificadas no SHA:**

- [CI 38292700529](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700529): **SUCCESS**, incluindo gate, banco, concorrência, acessibilidade/E2E e reconstrução histórica.
- [Stage4 38292694151](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292694151): pgTAP/concorrência e reconstrução histórica **SUCCESS**.
- [Preview](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700402) e [CodeQL](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700390): **SUCCESS**. Preview inclui smokes e acessibilidade pública.
- UI inalterada desde `9073c85`; evidência focal Playwright 4/4 reaproveitável. PR confirmada **OPEN/DRAFT, MERGEABLE**.

**Lacunas que impedem fechamento:**

1. O [job QA Stage4](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292694151/job/114958531923) **não iniciou** por pagamento/limite de gastos da conta, conforme anotação do GitHub. Integração ficou **SKIPPED**. O CI verde cobre os mesmos comandos de check/E2E; isso não indica regressão do produto, mas o Stage4 não está integralmente aprovado.
2. Não confirmei os quatro pareceres renovados exigidos pelo packet. As tentativas consultadas de banco/estatística falharam por capacidade; seus bloqueios anteriores não podem ser revogados por este QA.

Não repeti testes, apliquei SQL ou alterei arquivos/serviços. A reconstrução histórica valida esquema reconstruído, sem equivaler a homologação do banco compartilhado.

```text
SKILL_RESULT:
SKILL: running-release-gate
STATUS: BLOCKED
READINESS: NOT_READY
FINDINGS: achados anteriores de QA resolvidos
RESIDUAL_RISKS: Stage4 incompleto; pareceres obrigatórios não confirmados

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: PR #72 / Actions / REVIEW_PACKET / HANDOFF.md
ACAO: registrar esta revisão, resolver a pendência operacional do
Stage4 e obter os pareceres independentes renovados.
CRITERIO_DE_CONCLUSAO: gates exigidos e quatro pareceres válidos
no artefato final, sem bloqueios; depois encerrar a Etapa 9.
```

## Renovação focal final de QA

**PARECER: BLOCK_RELEASE — exclusivamente operacional.**

```text
WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE9-REVISION
BASE_COMMIT: 98212482e4c316ba0517df70fa9e2d9696f79641
COMMIT_REVISADO: 80a33355d98dc351214d825557323fa29ebf957b
REVIEWED_AT: 2026-10-12T18:51:43Z
```

Confirmados os três pareceres **APPROVE_WITH_NON_BLOCKING_NOTES** no SHA revisado: Harvey, Schrodinger e Hegel, com revogação expressa dos achados anteriores. **Retiro a pendência de pareceres especializados.**

Os achados QA de inativo, arquivado e concorrência permanecem resolvidos. Nenhum novo defeito funcional bloqueante. Incorporada a evidência informada de `merge-tree PASS`, sem merge.

O único bloqueio restante é o **Stage4 incompleto por cobrança**: [QA attempt2, job 114958949530](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292694151/job/114958949530) falhou sem iniciar, com a mesma anotação de faturamento; integração remota permanece não executada. CI equivalente, banco, concorrência, reconstrução histórica, Preview e CodeQL continuam verdes.

Sem mutações nesta revisão. Git antes/depois: mesmo arquivo de relatório não rastreado; HEAD preservado.

**Próximo passo exato:** project-maintainer registrar esta renovação, regularizar a execução do Actions e concluir QA/Integration Stage4 no mesmo artefato. `running-release-gate: BLOCKED` somente por essa pendência operacional.


