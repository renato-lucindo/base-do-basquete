# ADM-REF-02A — Tabela de submissões versionadas

## Escopo

A migration `game_data_submissions` separa a identidade estável do jogo das entradas que podem alimentá-lo. Ela cria somente o registro versionado das submissões; não escolhe autoridade por domínio, não altera os fluxos manual ou FIBA atuais, não faz backfill e não adiciona interface.

O contrato registra:

- origem `manual_scoresheet`, `fiba_boxscore` ou `legacy_seed`;
- papel `primary`, `fallback` ou `supplemental`;
- ciclo `draft`, `review`, `validated`, `active`, `rejected` ou `superseded`;
- versão da submissão, versão do parser quando aplicável, hash canônico e chave de idempotência;
- referência opaca ao objeto privado no Storage para boxscores;
- autoria, validação e justificativa de fallback/rejeição.

Versão, origem, parser, conteúdo, objeto e idempotência são imutáveis depois da criação. Metadados do ciclo podem evoluir sem reescrever a evidência submetida. Um índice parcial impede duas submissões ativas para o mesmo jogo, origem e versão de parser; versões manual e FIBA podem coexistir no mesmo `game_id`.

## Segurança

- RLS é habilitado e forçado desde a criação.
- `anon` não recebe privilégios.
- `authenticated` recebe somente leitura, filtrada pelo administrador singleton em AAL2.
- Mesmo o administrador AAL2 não grava diretamente: futuras mutações deverão passar por contratos server-side próprios.
- A sequência de identidade, o helper de imutabilidade e o gatilho não são expostos aos clientes.
- O caminho e o conteúdo do PDF não são copiados para a tabela pública; somente o UUID opaco de `storage.objects` é mantido.

## Baseline compartilhada — 02/09/2026

Antes da aplicação, `public.game_data_submissions` não existia. A base tinha 9 jogos, 18 participantes, 48 placares por período, 50 vínculos de jogo, 74 estatísticas por atleta/período, 81 faltas, 2 imports, 4 objetos no bucket privado e 19 auditorias administrativas. Os checksums usados na reconciliação foram:

| Relação | Linhas | Checksum MD5 |
| --- | ---: | --- |
| `games` | 9 | `dd9db6c8d1f8e754c856b4fa3a45d336` |
| `game_participants` | 18 | `44b32dcc6de392242c01141bb58caadd` |
| `game_period_scores` | 48 | `e4839876369501d5252e212e5862bc39` |
| `game_roster_slots` | 50 | `5d9f8d165d9ec33bc049a3cbedcbbd5c` |
| `player_period_stats` | 74 | `a480471277d3cef3198155a46922f958` |
| `foul_events` | 81 | `d7a9d14b3b262612925ef9c793ee4be4` |
| `boxscore_imports` | 2 | `3cd2fb57e6b5f5f7a210c420235ccb71` |
| `admin_mutation_audit` | 19 | `31a64de8776c4f5484f676cd86a63bf6` |

## Evidência antes da aplicação persistente

- DDL integral executada no Supabase compartilhado dentro de transação com rollback.
- pgTAP focado: 40/40, cobrindo contratos, coexistência de fontes, duplicidade ativa, idempotência, imutabilidade, grants e AAL2.
- Regressões em rollback: modelo canônico 34/34, súmula manual 19/19, importação FIBA 23/23 e relatório de classificação 40/40.
- A regressão manual foi medida por delta porque o teste legado espera zero auditorias preexistentes; as 19 auditorias reais foram somente lidas e preservadas.
- `npm run check`: formatação e lint em 116 arquivos, TypeScript estrito, 23 arquivos/88 testes, runbooks, build e varredura de 453 arquivos aprovados.
- Nenhuma linha compartilhada foi criada, alterada ou removida durante os testes.

## Aplicação e reconciliação final

A migration foi aplicada ao Supabase compartilhado como `20260902163902_game_data_submissions`, somente depois que `gate`, banco desde zero, preview e CodeQL aprovaram o commit `2ddd8e9` na PR #35.

O pgTAP persistido passou 40/40. A tabela terminou com zero linhas, confirmando a ausência de backfill, e o bucket permaneceu com 4 objetos. Todas as contagens e checksums da baseline permaneceram idênticos.

Os tipos gerados pelo schema remoto confirmaram integralmente o contrato TypeScript versionado. O advisor de segurança não apresentou achado relacionado à nova tabela. O advisor de desempenho marcou como ainda não usados apenas os três índices parciais de cobertura de FKs (`submitted_by`, `validated_by` e `storage_object_id`), resultado esperado antes da primeira submissão e sem motivo para removê-los.

`ADM-REF-02A` está concluída. `ADM-REF-02B` passa a ser a próxima task elegível; autoridade por domínio, RPCs de ativação e estado derivado continuam fora desta entrega.
