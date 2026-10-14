# Encerramento das revisões e integrações #79 e #73

Data: 14/10/2026. Responsável: project-maintainer.

As duas PRs foram integradas na ordem autorizada, após correção dos achados bloqueantes, novos pareceres independentes e gates aprovados. Este registro é editorial e não altera código, migrations, testes, configuração ou governança.

| Unidade | HEAD revisado | Integração verificada |
| --- | --- | --- |
| [PR #79](https://github.com/renato-lucindo/base-do-basquete/pull/79) | `bb3d4ac4526ad8a8ebafe287a75eb8b2e2702a9d`, seguido do ajuste editorial `7e37821cbd17489ca8a7b0142b16f7798d9487f2` | Merge `cfb461425b76d0a738e915bb6925025ff7c635b4`, 10:46:11 UTC |
| [PR #73](https://github.com/renato-lucindo/base-do-basquete/pull/73) | `c1323c3aa6fdce6b1549a9d1f943a466a798448b` | Squash `467d9e40ae559dc6d5bcf123a11fbd41f1c3a282`, 11:17:41 UTC |

As árvores dos commits integrados foram comparadas com os respectivos HEADs aprovados e eram idênticas. Nenhum WIP de pausa foi incorporado.

## Pareceres e evidências

A PR79 recebeu aprovação independente de [banco](https://github.com/renato-lucindo/base-do-basquete/pull/79#issuecomment-6162129056), [boxscore](https://github.com/renato-lucindo/base-do-basquete/pull/79#issuecomment-6162129258), [estatísticas](https://github.com/renato-lucindo/base-do-basquete/pull/79#issuecomment-6162124335) e [QA](https://github.com/renato-lucindo/base-do-basquete/pull/79#issuecomment-6162155848). O [QA editorial](https://github.com/renato-lucindo/base-do-basquete/pull/79#issuecomment-6166528738) confirmou UTF8/LF, encerrou o P3 documental e verificou a identidade das 725 entradas fora do HANDOFF com o artefato funcional aprovado.

Gates finais PR79: [CI38551232484](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38551232484), [preview38551232491](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38551232491) e [CodeQL38551232516](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38551232516) SUCCESS. Artefato funcional: 493 Vitest, 47 arquivos/1.303 assertivas pgTAP, fresh install, upgrades, concorrência e PostgREST. Os detalhes públicos anteriormente afetados retornaram HTTP200. [CI após merge38551883368](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38551883368) e [CodeQL38551883396](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38551883396) também passaram.

A PR73 recebeu pareceres renovados de [banco — Ptolemy](https://github.com/renato-lucindo/base-do-basquete/pull/73#issuecomment-6167075596), [acessibilidade — Popper](https://github.com/renato-lucindo/base-do-basquete/pull/73#issuecomment-6167092759) e [QA — Einstein](https://github.com/renato-lucindo/base-do-basquete/pull/73#issuecomment-6167114151), todos APPROVE_WITH_NON_BLOCKING_NOTES no mesmo BASE/HEAD. Esses pareceres encerraram os REQUEST_CHANGES anteriores; CI verde isoladamente não foi usado como aprovação.

Gates finais PR73: [CI38554674459](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38554674459), [preview38554674418](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38554674418) e [CodeQL38554674383](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38554674383) SUCCESS. Foram aprovados 512 Vitest, 17 Playwright (2 skips preexistentes), 49 arquivos/1.347 assertivas pgTAP, fresh install, upgrades, concorrência e PostgREST. Scan de 732 arquivos passou. As 16 novas assertivas SQL cobrem perfil compartilhado entre divisões, replay, expectativas divergentes/externas, justificativa de fonte e rollback.

## Correções integradas

Na PR79 foram corrigidos fingerprints legados, identidade por inscrição em resumos/histórico/URLs, replay HTTP da cópia, matching e persistência A/B em FIBA/Site, e fallback dos detalhes públicos no schema legado. Matching por sigla não pode contornar a inscrição revisada; placar, métricas coletivas e refresh transportam essa inscrição. Os dois formatos mantiveram seus contratos e indisponibilidades.

Na PR73 foram corrigidos o encaminhamento dos erros de identificação, replay HTTP de adição antes das escolhas mutáveis e reutilização do perfil criado dentro do próprio lote. Origem, AAL2, CSRF, contrato, UUID, revisão, CAS, autorização SQL e atomicidade permanecem obrigatórios. O ledger conserva o payload original; expectativa externa obsoleta, expectativa divergente e alteração de fonte sem justificativa continuam rejeitadas.

Migrations publicadas anteriores foram preservadas. A correção adicional da PR73 é `20261014110514_multi_dispute_shared_profile_context.sql`.

## Limitações e preservação

A [issue84](https://github.com/renato-lucindo/base-do-basquete/issues/84) acompanha possível deadlock entre UUIDs distintos com categorias em ordem inversa. É uma hipótese estática não reproduzida, classificada pelos revisores como P2 não bloqueante, com abort/retry e rollback integral previstos. A reprodução determinística e eventual correção aditiva pertencem a outra unidade.

Permanecem explicitadas as limitações de cobertura A/B com inversão/supplemental, zoom nativo, nome acessível do brand e movimento reduzido do shell herdado. Viewport720px foi usado como evidência de reflow de desktop1440px a200%; não foi apresentado como zoom nativo.

Não houve migration no Supabase compartilhado nem deploy de produção nesta unidade. JWTs simuladas no CI não comprovam GoTrue/MFA real. Rollout reconciliado, advisors produtivos e smoke autenticado continuam pendentes de unidade e autorização próprias. Os IDs remotos históricos da PR66, `20261005140439` e `20261005140504`, devem continuar preservados; não reaplicar migrations por simples divergência de timestamp.

A PR77 permaneceu aberta no HEAD `1df666858180d652f103eff5c182fb0c1d0ebb91`, sem alteração por esta unidade. Worktrees, arquivos não rastreados e checkpoints foram preservados. O incremento alheio `137b78b` permanece na branch remota `codex/preserve-roster-import-137b78b`; os checkpoints `cd906eb` e `440a0b1` continuam separados.

As pausas por uso foram respeitadas e as retomadas ocorreram depois dos resets, sem resgatar crédito de reset. Todos os revisores desta execução foram encerrados.

## Próximo passo da fila

A unidade autorizada de revisões/integrações79→73 está concluída. A issue84 contém a próxima investigação concreta em banco descartável; ela não foi iniciada como parte deste encerramento.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=issue84 e teste de concorrência descartável; ACAO=reproduzir o interleaving de UUIDs distintos com barreiras determinísticas e propor ordem consistente dos locks em unidade própria; CRITERIO_DE_CONCLUSAO=resultado explícito sem40P01, sem duplicidade ou estado parcial, com replay e pareceres válidos. Produção e Supabase compartilhado continuam fora desta autorização.
