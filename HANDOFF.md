# HANDOFF — Base do Basquete

> Checkpoint operacional para retomada. Histórico detalhado pertence ao Git, às PRs e a `docs/execution/`; não registre segredos aqui.

## 1. Objetivo vigente

Executar `DOC-GOV-02`: separar o estado operacional corrente do histórico acumulado no antigo `HANDOFF.md`, preservando a rastreabilidade e deixando um único próximo passo autoritativo.

Esta unidade é exclusivamente documental. Não altera produto, banco, migrations, Supabase, Cloudflare, produção ou contratos funcionais.

## 2. Unidade ativa e WRITE_LOCK

```text
WRITE_LOCK:
OWNER: project-maintainer
WORK_UNIT: DOC-GOV-02
BRANCH: codex/doc-gov-02
BASE_COMMIT: b663b7acf1be3ce5463468a17613ae983bbe5a26
SCOPE: reduzir HANDOFF, preservar histórico por evidência versionada e reconciliar o estado da governança documental
SCOPE_NEGATIVO: sem deduplicação ampla, movimentação/remoção de documentos, metadados em massa, novo gate de CI, código, banco, cloud, merge ou release
REQUIRED_REVIEWERS: qa-reviewer
STATUS: REVIEW
```

Somente `project-maintainer` possui o lock de escrita desta unidade. Revisão independente é read-only.

## 3. Git e integração corrente

- Worktree da unidade: `C:\Users\12405304716\.codex\worktrees\doc-gov-02\Base do Basquete`.
- Branch: `codex/doc-gov-02`, criada de `origin/main`.
- Base confirmada: `b663b7acf1be3ce5463468a17613ae983bbe5a26`.
- `origin/main` aponta para o mesmo commit.
- PR #64 está `MERGED`; merge commit `b663b7a` em 02/10/2026.
- CI da `main` no merge `b663b7a`: run `37004512230` aprovado; CodeQL `37004512245` aprovado. Nova execução de CodeQL `37304000358`, em 05/10/2026, também aprovada.
- Ainda não existe PR nem push para `codex/doc-gov-02` nesta unidade.
- Implementação documental commitada localmente em `d4d4fc0` (`docs: reduce operational handoff`).
- O checkout funcional original e seus arquivos não rastreados permanecem fora deste worktree e não devem ser limpos, movidos ou incorporados aqui.

## 4. Estado dos serviços e ambientes

- GitHub: `main` já contém a integração da PR #64.
- Supabase compartilhado: não alterado por `DOC-GOV-02`.
- Cloudflare preview/produção: não alterados por `DOC-GOV-02`.
- Produção: nenhuma ação autorizada ou executada nesta unidade.
- Qualquer rollout funcional pendente da linha da PR #64 deve ser tratado em unidade própria, com reconciliação dos serviços antes de agir; não pertence a `DOC-GOV-02`.

## 5. Mudanças desta unidade

- `HANDOFF.md`: convertido de dossier histórico de 603 linhas para checkpoint operacional.
- `docs/execution/DOC-GOV-02.md`: registro da extração, rastreabilidade e critérios de aceite.
- `docs/plan/README.md`: governança documental deixa de ser descrita como mera proposta e passa a refletir a implantação iniciada por `DOC-GOV-01`.
- `docs/plan/PLANO-GOVERNANCA-DOCUMENTAL.md`: estado reconciliado para implantação e próximo passo sequencial atualizado.
- `docs/governance/DOCUMENT-CATALOG.md`: classificação do handoff reconciliada sem mover fontes.

Enquanto o delta não estiver commitado, `git diff` deste worktree é a fonte para as mudanças não commitadas.

## 6. Evidências válidas

- `DOC-GOV-01` foi integrado em `main` pelo merge `4a5e628` da PR #56.
- `DOC-GOV-02` segue a Fase 2 de `docs/plan/PLANO-GOVERNANCA-DOCUMENTAL.md`.
- O antigo `HANDOFF.md` completo permanece recuperável em `b663b7a:HANDOFF.md` e no histórico Git.
- Evidências fechadas de pacotes permanecem em `docs/execution/`; ADRs permanecem em `docs/decisions/` e operação em `docs/runbooks/`.
- Validações da unidade estão registradas em `docs/execution/DOC-GOV-02.md`: inventário documental aprovado, `npm run check` aprovado após `npm ci`, 406 testes aprovados, build e secret scan aprovados, `git diff --check` aprovado e handoff com 108 linhas.

## 7. Riscos e bloqueios

- `qa-reviewer` é obrigatório antes de merge porque esta unidade altera governança e processo documental.
- Não antecipar `DOC-GOV-03` (deduplicação/movimentação), `DOC-GOV-04` (metadados), `DOC-GOV-05` (verificador/CI) ou `DOC-GOV-06` (baseline/gate bloqueante).
- Não usar o handoff reduzido para apagar evidência histórica: a fonte antiga permanece no Git e os fechamentos permanecem em `docs/execution/`.
- Não transformar `HANDOFF.md` novamente em changelog, relatório de testes cumulativo ou backlog histórico.

## 8. REVIEW_PACKET pronto para revisão

Enquanto não houver PR, o pacote de revisão permanece aqui conforme `.agents/agent-contract.md`:

```text
REVIEW_PACKET:
WORK_UNIT: DOC-GOV-02
BRANCH: codex/doc-gov-02
BASE_COMMIT: b663b7acf1be3ce5463468a17613ae983bbe5a26
OBJETIVO: tornar HANDOFF um checkpoint atual e preservar o histórico em fontes versionadas apropriadas
CRITERIOS_DE_ACEITE: HANDOFF < 200 linhas; um único próximo passo; histórico removido acessível no Git/docs/execution; nenhuma mudança funcional
ESCOPO_NEGATIVO: sem código, banco, cloud, deduplicação ampla, movimentação/remoção de fontes ou ativação de gate documental
REQUIRED_REVIEWERS: qa-reviewer
WRITE_LOCK_OWNER: project-maintainer
```

O `HEAD_COMMIT` para o parecer deve ser obtido com `git rev-parse HEAD` após este checkpoint estar commitado. Qualquer delta material posterior exige nova revisão.

## 9. Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: HEAD atual de codex/doc-gov-02
ACAO: obter parecer qa-reviewer para o HEAD exato atual, sem alterar arquivos enquanto o parecer estiver em curso
CRITERIO_DE_CONCLUSAO: parecer QA válido para o HEAD exato antes de qualquer push/PR/merge autorizado
```

## 10. Onde localizar o histórico

- Estado integral imediatamente anterior à redução: `git show b663b7a:HANDOFF.md`.
- Execuções concluídas: `docs/execution/`.
- Decisões arquiteturais: `docs/decisions/`.
- Procedimentos operacionais: `docs/runbooks/`.
- Plano e sequência da governança documental: `docs/plan/PLANO-GOVERNANCA-DOCUMENTAL.md`.
- Catálogo de autoridade/classificação: `docs/governance/DOCUMENT-CATALOG.md`.

Ao fechar uma unidade futura, registre o relato detalhado na PR ou em `docs/execution/` e mantenha aqui somente o estado necessário para a próxima retomada.
