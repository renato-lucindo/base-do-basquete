# Índice de tarefas — Digi Site Bask

## Resumo

O pacote contém **156 tarefas atômicas** em **9 áreas**, além deste índice e do guia de execução.

| Área | Quantidade | IDs principais | Resultado esperado |
| --- | ---: | --- | --- |
| Controle | 8 | TSK-000 a TSK-007 | Baseline, inventário, decisões e estratégia de rollout. |
| Dados | 15 | TSK-010 a TSK-024 | Modelo canônico, integridade, índices, RLS e tipos. |
| Contexto e rotas | 16 | TSK-030 a TSK-045 | URL como fonte da verdade e navegação isolada. |
| Estatísticas | 23 | TSK-050 a TSK-072 | Agregações, cache e UI por categoria. |
| Importação PDF | 18 | TSK-080 a TSK-097 | Upload seguro, match revisável e transação. |
| Inscrições e camisas | 13 | TSK-100 a TSK-112 | Elencos atômicos e camisa mais usada. |
| Súmula manual | 30 | TSK-120 a TSK-149 | Cabeçalho, relacionados, períodos, GD, OT e commit. |
| Admin e histórico | 15 | TSK-160 a TSK-174 | Hub progressivo, resultados e conquistas. |
| Qualidade e release | 18 | TSK-180 a TSK-197 | CI, benchmarks, staging, smoke e rollback. |

## Ponto de início obrigatório

Começar por `TSK-000-fixar-baseline.md`. As tarefas `TSK-000` a `TSK-007` são gates: nenhuma migration ou refatoração funcional deve ser iniciada antes delas.

## Como localizar um fragmento

Cada arquivo usa o formato:

`<área>/TSK-<id>-<descrição-curta>.md`

O front matter contém `id`, `tipo`, `dependencias` e `risco`. O corpo contém objetivo, escopo permitido, passos, critérios de aceite e proibições.

## Caminhos críticos

### Contexto público mínimo

`TSK-000 → TSK-004 → TSK-010 → TSK-011 → TSK-012 → TSK-030 → TSK-031 → TSK-032 → TSK-033 → TSK-038 → TSK-039 → TSK-045`

### Estatísticas isoladas

`TSK-006 → TSK-016 → TSK-031 → TSK-050 → TSK-051 → TSK-057 → TSK-058 → TSK-060 → TSK-061 → TSK-072`

### Importação segura

`TSK-021 → TSK-023 → TSK-080 → TSK-081 → TSK-082 → TSK-083 → TSK-086 → TSK-094 → TSK-095 → TSK-097`

### Inscrição e camisa histórica

`TSK-013 → TSK-014 → TSK-015 → TSK-100 → TSK-102 → TSK-106 → TSK-107 → TSK-108 → TSK-109 → TSK-110 → TSK-111 → TSK-112`

### Súmula manual completa

`TSK-017 → TSK-019 → TSK-020 → TSK-120 → TSK-121 → TSK-127 → TSK-128 → TSK-137 → TSK-139 → TSK-142 → TSK-144 → TSK-145 → TSK-146 → TSK-147 → TSK-148 → TSK-149`

## Estado atual que precisa ser auditado

O `main` observado já contém evidências de:

- `competition_series`, `team_registrations` e `roster_entries`;
- `competitionContextQuery` e rota pública contextual;
- editor de súmula manual;
- importador PDF com SHA-256, revisão de atletas e RPC transacional;
- consulta de perfil que reúne números de boxscore e súmula;
- componentes de gestão de campeonato.

Essas evidências não dispensam testes. Para cada fragmento, se o código atual satisfizer todos os critérios, o resultado correto é `VERIFICADA`, sem novo código.

## Paralelismo seguro

Somente tarefas sem dependência entre si e sem arquivo compartilhado devem ser executadas em paralelo. Arquivos centrais como `src/lib/queries.ts`, tipos Supabase, migrations e componentes administrativos devem ter um único responsável por vez.

## Saída mínima de cada tarefa

1. Estado final: `VERIFICADA`, `IMPLEMENTADA`, `REPROVADA` ou `BLOQUEADA`.
2. SHA-base.
3. Lacuna observada, se houver.
4. Arquivos alterados.
5. Testes executados e resultados.
6. Riscos residuais.
7. Próximas tarefas liberadas.
