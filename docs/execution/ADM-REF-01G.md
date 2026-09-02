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

A aplicação persistente da correção aguarda o novo gate remoto da PR #35.
