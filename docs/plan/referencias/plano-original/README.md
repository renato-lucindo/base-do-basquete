# Plano fragmentado de implementação — Digi Site Bask

## Finalidade

Este pacote transforma os quatro documentos de referência em tarefas pequenas, ordenadas e auditáveis. A decomposição considera o estado observado no branch `main` em 29/07/2026: TanStack Start/Router, React 19, Supabase, testes com `node:test` e funcionalidades que podem já estar parcial ou totalmente implementadas.

## Regra central de execução

Toda tarefa funcional segue o fluxo **auditar → provar a lacuna → aplicar a menor mudança → testar**.

1. Ler a tarefa e todas as dependências.
2. Confirmar o SHA-base e registrar os arquivos atualmente envolvidos.
3. Procurar implementação e testes existentes.
4. Se todos os critérios já estiverem cobertos, registrar `VERIFICADA` e encerrar sem alterar código.
5. Se houver lacuna, descrevê-la objetivamente antes de editar.
6. Alterar somente o escopo permitido.
7. Executar o teste-alvo e as verificações indicadas.
8. Registrar evidências: arquivos, testes, resultado e riscos residuais.

## Regras de isolamento

- Uma tarefa por branch ou commit lógico.
- Não atualizar dependências, formatar o repositório inteiro ou refatorar módulos vizinhos.
- Não misturar migration, interface e regra de negócio no mesmo fragmento, salvo quando a tarefa declarar isso.
- Não criar uma segunda modelagem paralela. Os nomes canônicos devem ser definidos em `TSK-004`.
- Não confiar apenas na interface para integridade ou autorização; regras críticas devem existir no banco/RPC ou no limite de servidor.
- Não executar migration destrutiva sem plano de compatibilidade, validação de dados e reversão.
- Não invalidar todo o cache quando for possível invalidar somente a competição afetada.
- Não remover tabelas ou colunas legadas durante este plano; a retirada exige plano separado.
- Não alterar `/admin` ao trabalhar nas rotas públicas, exceto nas tarefas que explicitamente autorizam isso.

## Estados permitidos

| Estado | Significado |
| --- | --- |
| `BLOQUEADA` | Dependência ou decisão pendente. |
| `PRONTA` | Dependências concluídas e escopo confirmado. |
| `EM_EXECUÇÃO` | Há uma única pessoa/agente trabalhando na tarefa. |
| `VERIFICADA` | Já existia e todos os critérios foram provados sem mudança. |
| `IMPLEMENTADA` | Lacuna corrigida e testes aprovados. |
| `REPROVADA` | Teste ou critério falhou; não deve avançar dependentes. |

## Ordem das frentes

1. `00-controle`: congelar contexto, inventariar e decidir contratos.
2. `01-dados`: consolidar o modelo relacional e as garantias no banco.
3. `02-contexto-rotas`: resolver e propagar o contexto da competição.
4. `03-estatisticas`: consultas, cache e interfaces por categoria.
5. `04-importacao-pdf`: segurança e pipeline transacional de boxscores.
6. `05-inscricoes-camisas`: inscrições, elencos e histórico de numeração.
7. `06-sumula-manual`: criação manual por períodos, faltas e prorrogação.
8. `07-admin-historico`: experiência administrativa e conquistas.
9. `08-qualidade-release`: CI, desempenho, implantação e reversão.

## Marcos de integração

| Marco | Requisito |
| --- | --- |
| M0 — diagnóstico confiável | `TSK-000` a `TSK-007` concluídas. |
| M1 — modelo estável | Todas as tarefas de `01-dados` concluídas. |
| M2 — contexto público | `02-contexto-rotas` concluída e `/admin` preservado. |
| M3 — leitura pública | Estatísticas e página de jogo isoladas por competição. |
| M4 — escrita segura | Importação, inscrições e súmula manual transacionais. |
| M5 — liberação | CI, smoke tests, observabilidade e rollback aprovados. |

## Arquivos de referência analisados

- `planejamento_arquitetura_basquete.md`
- `gemini-code-1785357005637.md`
- `gemini-code-1785357116955.md`
- `resumo-atualizacoes-ultimas-24h.md`

## Nota sobre divergências

Os documentos usam nomes diferentes para conceitos semelhantes (`championships`, `competitions`, `categories`, `rosters`, `competition_series`, `team_registrations`, `roster_entries`). O repositório observado já usa `competition_series`, `competitions`, `team_registrations` e `roster_entries`. Nenhuma tarefa pode introduzir os nomes alternativos antes da decisão registrada em `TSK-004`.
