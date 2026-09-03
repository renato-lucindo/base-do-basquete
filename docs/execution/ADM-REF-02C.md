# ADM-REF-02C — Backfill de submissões e autoridades

## Escopo

A migration `game_data_backfill` encapsula o histórico existente sem reescrever jogos, participantes, elencos, placares, estatísticas, faltas ou imports. A origem deriva somente da coluna legada comprovada: `manual` preserva hash, chave e ator da súmula; `boxscore` exige exatamente um import confirmado e um objeto privado correspondente; `seed` vira `legacy_seed` em revisão, sem ator ou validação inventados.

Somente submissões manual e FIBA comprovadas ficam ativas. A autoridade é criada apenas para os domínios declarados pela matriz de capacidades: seis por súmula manual e oito por boxscore FIBA/Genius Sports. `legacy_seed` não recebe capacidade nem autoridade e permanece em fila histórica para decisão administrativa futura.

## Integridade e segurança

- O backfill usa advisory lock transacional e é idempotente.
- Evidência manual incompleta, import FIBA ambíguo ou PDF não localizado abortam a transação inteira.
- O hash dos seeds é calculado sobre uma projeção determinística dos fatos esportivos, sem timestamps técnicos.
- O helper de escrita fica no schema privado, sem `EXECUTE` para clientes.
- O relatório público é somente leitura, exige administrador singleton em AAL2, usa `SECURITY DEFINER` com `search_path` vazio e não expõe caminhos do Storage.
- O seed local chama o helper somente ao final, depois que todos os fatos esportivos foram inseridos.

## Baseline e reconciliação

Antes da aplicação havia 9 jogos: 5 `seed`, 2 `manual` e 2 `boxscore`; 0 submissões, 0 autoridades, 2 imports confirmados e 4 objetos privados. Após a aplicação há 9 submissões, 4 ativas, 5 seeds em revisão e 28 autoridades. Os IDs dos jogos continuam `[4, 5, 6, 40, 41, 45, 46, 62, 63]`.

| Evidência histórica | Antes | Depois |
| --- | --- | --- |
| Jogos | 9 | 9 |
| Participantes | 18 | 18 |
| Períodos | 24 | 24 |
| Placares por período | 48 | 48 |
| Vínculos de jogo | 50 | 50 |
| Estatísticas de atleta/período | 74 | 74 |
| Faltas | 81 | 81 |
| Estatísticas coletivas | 4 | 4 |
| Estatísticas do jogo | 2 | 2 |
| Imports confirmados | 2 | 2 |

| Checksum | Antes e depois |
| --- | --- |
| Placares por período | `847fefb7c39119447f3ae10eb0419b81` |
| Pontos dos atletas | `957293c09608e9af9fa5cddaddf69c35` |
| Relacionados e DNP | `9391932eaa5ffe47e5b4bd6e4d3629ba` |
| Faltas | `132d68ea72222f1bd29085a9f4537205` |
| Desqualificações | `92e018e0110ffc5cbb510f575323694c` |
| Hashes de imports | `85419d16fa779a4db25981803e118e58` |

O relatório persistente retorna placares finais, pontos de equipe e atletas, faltas, desqualificações, hashes, parser, vínculo opaco do PDF e domínios esperados/ativos por jogo. A reconciliação final retornou `ready=true`, zero domínio ausente e zero autoridade em seeds.

## Gates

O ensaio integral e os 43 pgTAP foram executados primeiro em transação com rollback. O primeiro CI desde zero detectou que a chamada do helper estava cedo demais no seed; a migration enviada permaneceu imutável e somente a posição da chamada foi corrigida. O ciclo final aprovou 546 testes de banco, 88 testes da aplicação, formatação, lint, TypeScript, build, runbooks, varredura de segredos, preview e CodeQL.

A migration foi aplicada ao Supabase compartilhado como `20260903074040_game_data_backfill`; o pgTAP persistido passou 43/43 e o preview permaneceu saudável em `preview/ok`. Os advisors não mostraram falha nova: a RPC protegida aparece como `SECURITY DEFINER` intencional e os índices ainda sem uso refletem o volume pequeno. A PR #35 permanece aberta e em rascunho; não houve merge nem deploy de produção.

`ADM-REF-02C` está concluída. `ADM-REF-02D` é a única próxima task elegível.
