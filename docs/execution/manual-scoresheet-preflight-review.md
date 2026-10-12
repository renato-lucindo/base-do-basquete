# PR72 — correção e validação do preflight

Data:12/10/2026 (America/Araguaina). Base4ece9e7210ebf91e24007099a2b42654edd778e8. Esta unidade corrige o gerador de prévia; não aplica migrations nem integra código na main.

## REVIEW_PACKET

```text
WORK_UNIT: MANUAL-SCORESHEET-ROLLOUT-PREFLIGHT
BRANCH: codex/manual-stage4-v3-review; upstream origin/codex/manual-scoresheet-v2
BASE_COMMIT: 4ece9e7210ebf91e24007099a2b42654edd778e8
HEAD_COMMIT: publicado com SHA completo no comentário REVIEW_PACKET da PR72
OBJETIVO: tornar o preflight executável e comprovar exatamente seis migrations pendentes sem aplicação
CRITERIOS_DE_ACEITE: geração68 arquivos; plano remoto com seis pendentes; rejeição de inventário inesperado; gate/revisões proporcionais e evidência durável
ESCOPO: gerador, manifesto de aliases históricos, regressões e documentação/evidências
ESCOPO_NEGATIVO: migrations/SQL da feature, dados compartilhados, merge/main, produção, dependências, UI/estatística
ARQUIVOS_ALTERADOS: scripts/supabase-stage4-reconcile-overlay.mjs; app/supabase-stage4-preflight.test.ts; docs/execution/supabase-stage4-remote-migration-history.json; HANDOFF e relatório/logs desta unidade
MIGRATIONS: nenhuma criada/alterada/aplicada; seis pendentes preservadas
RISCOS_CONHECIDOS: overlay não é bootstrap; cobrança impede Actions; ambiente de homologação/recuperação ainda indisponível
TESTES_EXECUTADOS: Vitest focal4/4; npm run check68 arquivos/568 testes; geração e dry-run remoto EXIT0
EVIDENCIAS: logs versionados abaixo; inventário remoto comparado integralmente ao manifesto
AMBIENTE_VALIDADO: Windows/Node24.18.0/npm11.16.0/CLI2.118.0; remoto somente listagem e prévia
RISK_LEVEL: MODERADO operacional; banco/QA independentes solicitados pela relação com rollout e lacuna remota
RISK_JUSTIFICATION: script só prepara arquivos e imprime comando; SQL/Auth/RLS/autoridade não mudaram; riscos do procedimento revisados independentemente
REVIEW_DECISIONS: database-security-reviewer REQUIRED; qa-reviewer REQUIRED; estatística/acessibilidade WAIVED no delta por ausência de mudança nesses domínios
REQUIRED_REVIEWERS: database-security-reviewer, qa-reviewer
WAIVERS: sem nova análise estatística/UI/boxscore/performance; pareceres funcionais existentes preservados por domínio; sem dispensa de gate remoto de merge
REVIEW_APPROVER: project-maintainer
WRITE_LOCK_OWNER: project-maintainer
```

## Problemas corrigidos

1. Contagem fixa66 e mensagem de quatro pendentes foram substituídas pelo inventário:62 aplicadas+6 pendentes=68 arquivos. A baseline62 continua explicitamente exigida; não há aceitação silenciosa de histórico diferente.
2. O script também falhava porque season_division_model e edition_creation_workflow já existem localmente sob versões distintas das remotas. O manifesto registra somente os aliases locais auditados20261002144945 e20261005124828; mudança inesperada continua rejeitada. Entradas applied e os SQLs originais foram preservados.
3. Para os três nomes históricos remotos especiais, o overlay conserva os filenames remotos e marcadores que falham se executados. Não copia o SQL local com outra versão para simular equivalência. O overlay continua exclusivamente para comparação de histórico; não deve ser usado em banco novo.
4. O comando impresso inclui--dry-run e--skip-vault. CLI instalada foi conferida por--help: o comando padrão pode atualizar Vault; a prévia desta unidade desabilita esse caminho. [Referência oficial da CLI](https://supabase.com/docs/reference/cli/supabase-db-push) consultada, junto do changelog; nenhuma integração/versão foi atualizada.

## Verificações executadas

- Vitest focal4/4 PASS: geração real com68 filenames exatos, bytes das seis pendentes preservados, marcadores históricos protegidos, migração local não auditada rejeitada, pendente ausente rejeitada e alias histórico com versão alterada rejeitado. Testes usam fixtures/temporários próprios e nunca executam Supabase ou SQL.
- Gate completo `npm run check` EXIT0:68 arquivos/568 Vitest PASS; formato, lint sem erros (320 warnings/27 infos), typecheck, runbooks5, configuração de agentes, build client/SSR e scan770. Suítes funcionais de navegador/pgTAP anteriores preservadas: nenhum SQL, rota, domínio ou UI mudou.
- Geração real do overlay EXIT0,68 migrations. Dry-run real EXIT0 com--skip-vault: propõe exatamente as seis migrations do manifesto, seeds=[],roles=[],dryRun=true. [Log da prévia](evidence/manual-scoresheet-preflight/dry-run.log).
- [Log do gate completo](evidence/manual-scoresheet-preflight/npm-check.log). Logs sanitizados removem ANSI, caminhos locais e espaços finais. SHA256 publicados: dry-run a686be35a84954c2122d18af60d5e23853f0ee3762e8a9a6dc4d4c761e4fbfb0; check3fc696201aa4961691c37993cd5e8cece6bc81eedf2d2868d01d49166ae34dc9.
- Listagem remota posterior à prévia comparada por versão/nome e ordem: igualdade integral com as62 entradas applied do manifesto; última20261005140504; seis pendentes ausentes. Nenhuma migration da feature foi aplicada. Consulta SQL agregada confirmou62/última versão; sem ler dados de usuários.

A primeira regressão revelou a rejeição dos aliases locais, corrigida antes do gate estável. O gate completo passou uma vez após estabilização; não repetir após registro documental do resultado.

## Limites de homologação e recuperação

Docker/psql/servidor PostgreSQL não encontrados no PATH/caminhos padrão nem serviços/processos correspondentes. A pasta PostgreSQL17 contém somente data, sem binários. Supabase list_branches retorna apenas a própria main (is_default=true,parent_project_ref igual ao projeto), com MIGRATIONS_FAILED; não é ambiente isolado para ensaio. Não foi criada infraestrutura paga nem alterado o compartilhado.

As RPCs v2 dependem das migrations pendentes. Portanto homologação autenticada sobre schema atualizado e ensaio representativo de backup/restauração ainda não foram executados. Os testes descartáveis SQL/AAL2/concorrência verdes da feature permanecem válidos para seu artefato; não equivalem a esse ensaio operacional. Para concluir o rollout, é necessário disponibilizar ambiente isolado representativo e capacidade dos Actions, preservando a restrição de não aplicar schema no compartilhado nesta entrega.

Plano de aplicação/recuperação: [packet da Etapa10](manual-scoresheet-stage10-final-gate.md). AuditDEV segue em unidade própria, sem atualização de dependências neste preflight. Nenhum pagamento, proteção de branch, merge ou deploy foi executado.

## Revisões e estado remoto

Pareceres de banco/QA no commit9acc537: APPROVE_WITH_NON_BLOCKING_NOTES. Preflight técnico READY; merge/rollout NOT_READY. Packet publicado em https://github.com/renato-lucindo/base-do-basquete/pull/72#issuecomment-6134384991. Resultados integrais abaixo; delta posterior registra somente os resultados e alinha o lock.

### Actions e condição de ambiente

No9acc537: [CI38320813742](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38320813742), [Preview38320813661](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38320813661), [CodeQL38320813647](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38320813647), [Stage438320807932](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38320807932) FAILURE. Um job falho de cada workflow inspecionado:zero etapas e annotation de pagamento/limite. Não reexecutados repetidamente sem mudança da capacidade.

Responsável respondeu expressamente “Ainda não há ambiente isolado”. Homologação autenticada/recuperação aguardam provisionamento de um ambiente próprio; não usar a main como substituto. Cobrança é pendência operacional externa; nenhuma configuração financeira ou proteção foi alterada. O próximo passo não é aplicar migrations no compartilhado.

P3 do QA sobre identificação do lock corrigido no fechamento: base4ece9e7, commit revisado9acc537 e unidade MANUAL-SCORESHEET-ROLLOUT-PREFLIGHT. Nenhum delta funcional após os pareceres.

## Banco — Harvey (parecer integral)

PARECER: **APPROVE_WITH_NON_BLOCKING_NOTES**  
WORK_UNIT: MANUAL-SCORESHEET-ROLLOUT-PREFLIGHT  
BASE_COMMIT: 4ece9e7210ebf91e24007099a2b42654edd778e8  
COMMIT_REVISADO: 9acc5370564230211004491e79a679a2a95ec8ad  
REVIEWED_AT: 2026-10-12T23:13:16Z

ESCOPO_REVISADO: gerador, manifesto, quatro regressões e evidências do [REVIEW_PACKET](https://github.com/renato-lucindo/base-do-basquete/pull/72#issuecomment-6134384991).

**PROBLEMA_TECNICO: RESOLVIDO.** A contagem deriva de `62+6=68`, mantendo o guard explícito da baseline62. Os aliases locais `season_division_model@20261002144945` e `edition_creation_workflow@20261005124828` são conferidos por filename exato. Os três históricos especiais sempre geram placeholders com exceção, sem copiar/reaplicar seu SQL local.

MIGRATIONS: nenhuma criada ou alterada. Lista `applied` preservada. Consulta remota própria confirmou igualdade integral, inclusive ordem, com as62 entradas do manifesto; última `20261005140504`; seis pendentes ausentes.

RLS_E_GRANTS: inalterados; análise funcional SQL anterior não repetida.

INTEGRIDADE_E_TRANSACOES: rejeições preservadas para inventário desconhecido, migration pendente ausente e alias alterado. O gerador apenas prepara arquivos temporários e imprime a prévia. Comando contém `--dry-run --skip-vault`; confirmei ambos na CLI instalada2.118.0. A função de prévia de `--dry-run` também está documentada pela [Supabase](https://supabase.com/docs/reference/cli/supabase-db-push).

PRIVACIDADE: sem nova exposição identificada no delta ou nos logs examinados.

TESTES_E_EVIDENCIAS:

- Execução própria: **4/4 regressões PASS**, sintaxe Node e `git diff --check` PASS.
- Testes verificam68 filenames exatos, conteúdo das seis pendentes preservado, placeholders protegidos e rejeições esperadas.
- Log versionado do dry-run: exatamente seis pendentes, `dryRun=true`, `seeds=[]`, `roles=[]`.
- Log do gate: **68 arquivos/568 testes PASS**. Hashes SHA256 dos dois logs conferem com o relatório.
- Gate completo, dry-run remoto, SQL e UI não foram repetidos.

ACHADOS: nenhum novo P0–P3 no escopo focal.

RISCOS_RESIDUAIS: overlay serve exclusivamente à comparação de histórico; não comprova equivalência do schema nem permite bootstrap. Revalidar o inventário remoto antes de qualquer aplicação.

READINESS_PREFLIGHT_TECNICO: **READY**.  
READINESS_MERGE: **NOT_READY**.  
READINESS_ROLLOUT: **NOT_READY**. Homologação autenticada e recuperação representativa continuam pendentes. CI do SHA revisado falhou sem iniciar o gate; annotation confirma restrição de faturamento/limite. Este parecer não aprova rollout.

GIT_STATUS_ANTES: limpo.  
GIT_STATUS_DEPOIS: limpo; HEAD fixo preservado. Sem mutação versionada ou remota.

SKILL_RESULT:  
SKILL: reviewing-supabase-changes  
STATUS: PASS no preflight focal.  
HEAD_COMMIT: 9acc5370564230211004491e79a679a2a95ec8ad  
GATES_OMITTED: gate completo e SQL/UI inalterados; homologação/recuperação indisponíveis.

PROXIMO_PASSO_EXATO:  
RESPONSAVEL: project-maintainer  
ARQUIVO_OU_SERVICO: PR72, HANDOFF e ambiente isolado de homologação.  
ACAO: registrar o parecer; concluir QA focal, restabelecer Actions e produzir evidências autenticadas e de recuperação em ambiente isolado.  
CRITERIO_DE_CONCLUSAO: pareceres e gates válidos, inventário revalidado e ensaios operacionais aprovados antes de recomendar rollout.

## QA — Archimedes (parecer integral)

**PARECER: APPROVE_WITH_NON_BLOCKING_NOTES — QA do preflight local.**

```text
WORK_UNIT: MANUAL-SCORESHEET-ROLLOUT-PREFLIGHT
BASE_COMMIT: 4ece9e7210ebf91e24007099a2b42654edd778e8
COMMIT_REVISADO: 9acc5370564230211004491e79a679a2a95ec8ad
REVIEWED_AT: 2026-10-12T23:13:40Z
GIT_STATUS_ANTES: limpo
GIT_STATUS_DEPOIS: limpo
```

Confirmei o packet publicado e executei somente o teste focal: **4/4 PASS**. As regressões exercitam o gerador real:

1. Geração dos 68 filenames esperados, seis pendentes com conteúdo preservado e marcadores históricos protegidos.
2. Rejeição de migration local não auditada.
3. Rejeição de pendente ausente.
4. Rejeição de alias histórico com versão alterada.

O log versionado confirma **68 arquivos/568 testes PASS**, build e scan770 concluídos. Os hashes dos dois logs correspondem aos publicados.

O dry-run registra **exatamente as seis pendentes**, `dryRun=true`, `seeds=[]` e `roles=[]`. Conferi no help da CLI2.118.0 que `--skip-vault` desabilita a atualização de Vault; a função de prévia de `--dry-run` também consta na [referência oficial](https://supabase.com/docs/reference/cli/supabase-db-push).

Consultei apenas o inventário remoto: **62 migrations**, última `20261005140504`, com igualdade integral de versão/nome e ordem frente ao manifesto. Não executei SQL nem repeti o dry-run.

**Achados:** nenhum novo bloqueante técnico de QA. Nota **P3** em `HANDOFF.md:20–21`: o lock da unidade nova ainda aponta base `84f4510` e packet `9ca4065`; alinhar ao base/HEAD deste parecer no fechamento. A seção39 e o packet já identificam corretamente a unidade.

Os pareceres anteriores de estatística/UI e o aceite funcional de `80a3335` permanecem aplicáveis: SQL, aplicação, dependências e workflows não mudaram. **A revisão nova de banco/preflight de Harvey ainda estava em andamento**; a aprovação antiga da feature não a substitui.

| Readiness | Resultado |
| --- | --- |
| Gerador/preflight local, domínio QA | **READY** |
| Fechamento da unidade | Aguardando parecer de banco e registro final |
| Merge | **NOT_READY** — checks remotos não aprovados |
| Rollout | **NOT_READY** — homologação autenticada e ensaio de recuperação pendentes |

Confirmei o gate remoto atual como **FAILURE, zero etapas, por cobrança**. O aceite local não transforma esse check em SUCCESS. O overlay permanece impróprio para bootstrap.

Não repeti gate completo, build, pgTAP ou UI; nenhuma mutação versionada ou compartilhada.

```text
SKILL_RESULT:
SKILL: running-release-gate
STATUS: PASS
SCOPE: QA incremental do preflight local
RESIDUAL_RISKS: parecer de banco, Actions e ensaio operacional pendentes
```

**Próximo passo exato:** project-maintainer incorporar este parecer, alinhar o lock e consolidar o resultado de Harvey. Encerrar o preflight somente com ambos os pareceres válidos, preservando as pendências de merge/rollout e sem aplicar migrations.

### Consolidação do mantenedor

Os dois pareceres acima são válidos no mesmo9acc537. O parecer de Harvey encerra a condição de banco ainda pendente quando o QA concluiu sua análise; não há achados bloqueantes. P3 documental corrigido. A unidade de preflight está concluída; as condições operacionais de integração/release permanecem abertas. Skills managing-base-work-unit/reviewing-supabase-changes/running-release-gate PASS no escopo preflight; merge/rollout NOT_READY.
