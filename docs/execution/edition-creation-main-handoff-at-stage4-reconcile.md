# HANDOFF — Base do Basquete

> Checkpoint operacional da linha de edições multidimensionais. Histórico detalhado e evidências anteriores permanecem no Git, nas PRs e em `docs/execution/`. Não registrar segredos.

## 1. Unidade corrente e integração

`EDITION-CREATION-PR66-MAIN-RECONCILE`: reconciliação da PR draft #66 (`codex/season-division-model`) com `main` em 08/10/2026, após a integração da governança documental pela PR #71 (merge `8ac6220`). O conflito de `HANDOFF.md` foi reconciliado com o formato compacto da governança; `docs/plan/README.md` teve merge automático.

Este merge de integração agrega a governança documental de `main`, sem mudança deliberada no comportamento funcional, migrations da PR #66 ou infraestrutura. Os commits funcionais anteriores mantêm sua validade histórica; CI e verificação do HEAD resultante são necessários antes de integrar.

```text
WRITE_LOCK:
OWNER: project-maintainer
WORK_UNIT: EDITION-CREATION-PR66-MAIN-RECONCILE
BRANCH: codex/season-division-model
BASE_COMMIT: 3d27b45b60b3f15dcf4ebe9053441efc406f773c
SCOPE: reconciliar o merge de main na PR66 e atualizar checkpoint documental
SCOPE_NEGATIVO: sem novas migrations, alteração de dados no Supabase, merge na main ou produção
REQUIRED_REVIEWERS: dispensa especializada para delta de merge/documentação sem mudança funcional, sujeita à confirmação do diff
STATUS: RELEASED
```

## 2. Sequência das PRs

- PR #66: edição/temporada/divisões; draft sobre `main`; branch `codex/season-division-model`. Commit funcional revisado `4542f44`; último HEAD anterior a este merge `3d27b45`.
- PR #68: cadastro de edição sem naipe, dependente da #66; draft sobre `codex/season-division-model`; HEAD anterior `be8cb34`.
- PR #69: inscrições independentes e cópia transacional, dependente da #68; draft sobre `codex/edition-identity-no-gender`; HEAD documental `b9c8d57` já publicado em 08/10. Artefato funcional revisado `a5c84f4`.
- PR3: criação múltipla de disputas/navegação, implementada localmente na branch `codex/multi-dispute-creation-navigation` (HEAD `f1f2112`), aguardando publicação e gates remotos, na sequência da #69.
- PR4/PR5: importação individual e em lote permanecem etapas posteriores e devem usar unidades/branches próprias.

As PRs são empilhadas e precisam ser conciliadas em ordem. Nenhuma PR desta sequência deve ser tratada como integrada à `main` sem verificação remota.

## 3. Banco e serviços

- Supabase compartilhado: as migrations funcionais da PR #66 `20261002144945_season_division_model.sql` e `20261005124828_edition_creation_workflow.sql` já foram aplicadas em 05/10/2026 com IDs remotos `20261005140439` e `20261005140504`. **Não reaplicar** por divergência de timestamp.
- Após o rollout PR66: cinco temporadas, seis competições, dez jogos, nenhuma disputa sem temporada e nenhum ledger de workflow persistido. Testes pgTAP focais 43/43 em transação revertida; AAL2 em preview verificado sem criação real de edição pela interface.
- Migrations PR1/PR2/PR3 ainda não aplicadas ao Supabase compartilhado neste checkpoint.
- Produção Cloudflare permaneceu inalterada no último checkpoint verificado da PR66. Novo deploy depende de gate apropriado.

## 4. Evidências e riscos

- PR #66, funcional `4542f44`: pareceres banco/segurança, acessibilidade e QA `APPROVE`, sem P0–P3; CI, banco/pgTAP, preview e CodeQL verdes no artefato funcional. Os cinco checks antigos também estavam verdes no HEAD `3d27b45`.
- PR #69, funcional `a5c84f4`: pareceres especializados aprovados ou aprovados com notas não bloqueantes; CI (incluindo 45 arquivos/1.264 assertivas pgTAP), preview e CodeQL verdes. No HEAD apenas documental `88d0b13`, os três workflows também estavam verdes. `b9c8d57` ainda não apresentou checks próprios na consulta de 08/10.
- O merge de `main` na PR66 altera a base da pilha: reconfirmar compatibilidade das PRs #68/#69, atualizar seus branches sem force-push e exigir seus checks para os HEADs correspondentes.
- Não declarar aprovação final de release com base apenas nos pareceres de working tree. Manter PRs draft até o gate de integração aplicável.

## 5. REVIEW_PACKET

```text
REVIEW_PACKET:
WORK_UNIT: EDITION-CREATION-PR66-MAIN-RECONCILE
BRANCH: codex/season-division-model
BASE_COMMIT: 3d27b45b60b3f15dcf4ebe9053441efc406f773c
OBJETIVO: eliminar conflito de merge com main, conservando o checkpoint documental compacto
CRITERIOS_DE_ACEITE: sem conflitos, diff funcional preservado, gates remotos do HEAD resultante aprovados, cadeia empilhada coerente
ESCOPO_NEGATIVO: sem nova migration, alteração de banco compartilhado ou deploy em produção
REQUIRED_REVIEWERS: dispensa de revisão especializada se o delta for comprovadamente apenas documental/merge; caso contrário renovar pareceres proporcionais
WRITE_LOCK_OWNER: RELEASED
```

## 6. Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: GitHub PR #66, PR #68, PR #69 e branch codex/multi-dispute-creation-navigation
ACAO: publicar o merge reconciliado da PR66; validar CI/database/preview/CodeQL; reconciliar PR68/69 em ordem e publicar a PR3 como draft; executar os gates SQL/CI, revisões e smoke necessários para cada SHA funcional
CRITERIO_DE_CONCLUSAO: PR66 sem conflito; stack PR68/69 consistente; PR3 draft com evidências remotas e pareceres vinculados ao SHA; sem perda de worktrees/untracked
```

## 7. Rastreabilidade

O histórico longo da PR66 permanece em `3d27b45:HANDOFF.md`, o checkpoint da governança em `8ac6220:HANDOFF.md`, os resultados no histórico de comentários/checks das PRs #66/#68/#69 e os pacotes encerrados em `docs/execution/`. Preserve as worktrees em andamento e os não rastreados de outros trabalhos.
