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

Pareceres de banco/QA no commit fixo e checks da PR serão registrados após publicação. Não há aprovação antecipada. O gerador/testes/dry-run estão verdes; prontidão de integração e rollout continua condicionada aos gates e ambientes descritos.
