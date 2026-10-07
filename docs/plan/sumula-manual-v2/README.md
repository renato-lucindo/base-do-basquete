# Execução retomável — Súmula manual v2

Este diretório divide a implementação da **Súmula manual v2 com lançamento rápido e regras FIBA 2024** em checkpoints independentes dentro da mesma PR. O objetivo é permitir retomada pelo último checkpoint concluído sem reconstruir o contexto da feature.

O plano funcional de referência permanece em [`PLANO-SUMULA-MANUAL-V2.md`](../../../PLANO-SUMULA-MANUAL-V2.md). Estes arquivos organizam a execução; não substituem as decisões funcionais registradas no plano principal.

## Pré-condição de abertura

A feature da súmula manual v2 só deve assumir o lock depois que qualquer unidade anterior for liberada ou formalmente entregue. Um worktree separado evita mistura de arquivos, mas não substitui o controle do write lock.

Ao abrir a unidade:

- criar branch e worktree exclusivos a partir da base estável definida;
- preservar integralmente o workspace atual;
- registrar `WORK_UNIT`, objetivo, critérios de aceite, escopo negativo e revisores;
- definir a versão do editor e do `localStorage` antes das mudanças funcionais.

## Ordem de execução

| Ordem | Etapa | Arquivo | Resultado esperado |
| --- | --- | --- | --- |
| 0 | Abrir unidade e isolar ambiente | [`00-abrir-unidade-e-isolar-ambiente.md`](00-abrir-unidade-e-isolar-ambiente.md) | branch/worktree limpos, lock correto e handoff retomável |
| 1 | Domínio FIBA 2024 | [`01-dominio-fiba-2024.md`](01-dominio-fiba-2024.md) | regras de faltas testáveis sem banco |
| 2 | Persistência aditiva | [`02-persistencia-aditiva.md`](02-persistencia-aditiva.md) | schema compatível, RLS e upgrade validados |
| 3 | Criação transacional | [`03-criacao-transacional-jogo-sumula.md`](03-criacao-transacional-jogo-sumula.md) | jogo + súmula atômicos e idempotentes |
| 4 | Revisões e auditoria | [`04-revisoes-e-auditoria-backend.md`](04-revisoes-e-auditoria-backend.md) | revisão versionada e concorrência protegida |
| 5 | Wizard de jogo e equipes | [`05-wizard-jogo-equipes.md`](05-wizard-jogo-equipes.md) | configuração restaurável em `localStorage` |
| 6 | Pontuação rápida | [`06-lancamento-rapido-pontos.md`](06-lancamento-rapido-pontos.md) | lançamento integral por teclado |
| 7 | Faltas rápidas | [`07-lancamento-rapido-faltas.md`](07-lancamento-rapido-faltas.md) | comandos FIBA 2024 e GD validados |
| 8 | Revisão final e confirmação | [`08-revisao-final-confirmacao.md`](08-revisao-final-confirmacao.md) | fluxo novo completo de ponta a ponta |
| 9 | Edição de súmula existente | [`09-edicao-sumula-existente.md`](09-edicao-sumula-existente.md) | revisão de súmula salva com histórico |
| 10 | Gate e fechamento da PR | [`10-gate-e-fechamento-pr.md`](10-gate-e-fechamento-pr.md) | HEAD fixo, gates verdes e pareceres válidos |

## Regra de avanço

Não iniciar a etapa seguinte enquanto o checkpoint da etapa atual não estiver verde.

Ao fim de cada etapa:

1. executar `git status`;
2. executar os testes focais correspondentes;
3. criar um commit coerente para a etapa;
4. registrar no `HANDOFF.md` o `HEAD_COMMIT`, os testes realmente executados e um `PROXIMO_PASSO_EXATO`.

## Regra de interrupção

Se houver interrupção no meio de uma etapa, terminar a menor unidade segura possível. Quando isso não for viável, registrar um commit WIP claramente identificado e documentar no handoff:

- arquivos incompletos;
- testes ainda não executados;
- estado real de migrations/RPCs/UI;
- ponto exato de retomada.

Nenhuma migration, RPC ou interface deve ser considerada concluída apenas porque parte do código já existe.

## Revisores esperados

Pelo escopo previsto, o fechamento deve envolver `database-security-reviewer`, `statistics-domain-reviewer`, `accessibility-ui-reviewer` e `qa-reviewer`. O `boxscore-domain-reviewer` entra somente se a implementação tocar contratos ou persistência de boxscore.
