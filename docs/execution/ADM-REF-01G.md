# ADM-REF-01G — Relatório de classificação e backfill

## Escopo

A migration `classification_backfill_reconciliation` adiciona somente contratos de leitura administrativa protegidos. As escolhas continuam sendo gravadas pelas RPCs AAL2 já existentes para revisão de naipe, perfil e elegibilidade privada. Nenhum valor é sugerido, preenchido ou alterado automaticamente.

O relatório protegido reúne:

- evidência factual de fontes por edição (`manual`, `boxscore` e `seed`);
- filas de edição e atleta sem retornar o valor privado do atleta;
- vínculos imutáveis entre edição e versão de perfil, inclusive divergências históricas;
- contagens e checksums de jogos, participantes, períodos, placares, pontos, relacionados/DNP, faltas, desqualificações, imports e cobertura avançada;
- bloqueadores objetivos para o enforcement posterior.

## Baseline compartilhada — 02/09/2026

| Item | Antes da migration |
| --- | ---: |
| Edições | 4 |
| Edições com naipe revisado | 2 |
| Edições com naipe pendente | 2 |
| Edições com perfil vinculado | 2 |
| Edições com perfil pendente | 2 |
| Atletas privados | 44 |
| Atletas com elegibilidade pendente | 44 |
| Perfis ativos | 2 |
| Jogos | 9 |
| Elencos ativos | 48 |
| Imports confirmados | 2 |
| Auditorias administrativas | 19 |

As duas edições classificadas já tinham decisões administrativas explícitas e perfis imutáveis vinculados. As outras duas edições e os 44 atletas permanecem pendentes. Esses valores não serão inferidos pela migration.

## Evidência antes da aplicação persistente

- DDL integral executada em transação com rollback no Supabase compartilhado.
- 40/40 asserções pgTAP focadas aprovadas em rollback.
- Regressões aprovadas em rollback: perfil/naipe 55/55, fluxo privado 24/24, elenco 26/26 e importação 32/32.
- Formatação e lint aprovados em 116 arquivos; TypeScript estrito e geração de tipos aprovados.
- Nenhuma contagem ou checksum histórico foi alterado pelos testes.

## Aplicação e reconciliação final

A migration principal foi aplicada ao Supabase compartilhado como `20260902114439_classification_backfill_reconciliation`, somente depois de `gate`, `database`, preview e CodeQL aprovarem o commit `c474540` na PR #35.

A leitura pós-aplicação detectou um erro apenas no relatório: o `LEFT JOIN` contava o composto inteiramente nulo como uma linha de estatística coletiva nas edições sem cobertura avançada. O histórico permaneceu inalterado. Como a migration original já estava versionada e aplicada, ela não foi reescrita; a correção aditiva `classification_backfill_coverage_fix` eleva o contrato para a versão 2 e substitui somente a contagem de cobertura por edição. Em rollback, o resultado corrigido foi `0/0` para as edições 1, 8 e 9 e `4/2` para a edição 20 (linhas coletivas/linhas de jogo).

A correção foi registrada no commit `e14d672`. O novo `gate`, banco desde zero, preview e CodeQL passaram; em seguida, ela foi aplicada ao Supabase compartilhado como `20260902115601_classification_backfill_coverage_fix`. O pgTAP persistido passou 40/40.

## Resultado final

- Relatório v2: 4 edições, 44 atletas privados, 2 perfis ativos e nenhuma versão substituída.
- Filas explícitas: 2 edições sem naipe, 2 sem perfil e 44 atletas sem revisão privada; por isso `enforcementReady=false`.
- Divergências entre perfis de edições: zero na base compartilhada atual.
- Histórico reconciliado e preservado: 9 jogos, 18 participantes, 48 placares por período, 50 vínculos de jogo, 74 estatísticas por atleta/período, 81 faltas, 2 imports, 4 linhas coletivas e 2 linhas avançadas de jogo.
- Cobertura avançada por edição: edições 1, 8 e 9 com `0/0`; edição 20 com `4/2` (linhas coletivas/linhas de jogo).
- Grants e privacidade: helper e views seguem privados; o RPC público nega `anon`, aceita somente `authenticated` e exige administrador singleton em AAL2 antes de retornar filas sem o valor privado do atleta.
- Advisors: nenhum achado novo acionável. Os avisos de RPCs administrativos `SECURITY DEFINER` são intencionais e cobertos por singleton AAL2 e `search_path` vazio; RLS sem policy em tabelas privadas e índices ainda sem uso continuam documentados. A tabela legada privada de tentativas de upload segue sem RLS, porém fora do schema exposto e sem privilégios para `anon`/`authenticated`; o hardening foi adiado para não ampliar este cartão.

O relatório explica todas as diferenças observadas e identifica integralmente os bloqueadores. Nenhum valor foi inferido, nenhum histórico foi reescrito e a coluna legada foi preservada. `ADM-REF-01G` está concluída; `01H` deve ser apenas avaliada como portão condicional antes de avançar para `02A`.
