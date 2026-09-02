# ADM-REF-02B — Autoridade por domínio e estado derivado

## Escopo

A migration `game_data_domain_authority` adiciona a camada de decisão sobre as submissões versionadas criadas na `ADM-REF-02A`. Ela não adapta a súmula manual nem o importador FIBA, não faz backfill, não compara dados visualmente e não adiciona interface.

O contrato contém três peças independentes:

- `game_data_source_capabilities`: matriz fechada dos domínios que cada fonte da primeira temporada consegue fornecer e da precisão disponível;
- `game_data_domain_authority`: exatamente uma submissão ativa e compatível por jogo/domínio, com revisão e autoria da ativação;
- `game_data_status`: visão administrativa calculada a partir do perfil esperado, das submissões, das autoridades e das lacunas, sem coluna de status persistida no jogo.

A súmula manual pode responder por resultado, períodos, participação, pontuação, total e linha do tempo de faltas. O boxscore FIBA/Genius Sports pode responder pelos domínios comuns, por estatísticas avançadas de atleta/equipe/jogo e somente pelo total de faltas; ele não declara uma linha do tempo de faltas que o documento não contém. `legacy_seed` permanece sem capacidades até a classificação e o backfill exclusivos da `ADM-REF-02C`.

## Concorrência e integridade

- A chave `(game_id, domain)` impede duas autoridades simultâneas para o mesmo domínio.
- A FK composta da autoridade para `(submission_id, game_id, source_type)` impede usar uma submissão de outro jogo ou declarar outra fonte.
- A FK para a matriz de capacidades impede uma fonte incapaz de se tornar autoridade.
- A submissão precisa estar `active` e não pode ser desativada ou removida enquanto for referenciada.
- A ativação serializa o par jogo/domínio com advisory lock transacional.
- O parâmetro `expected_submission_id` implementa compare-and-swap: uma decisão concorrente desatualizada recebe `BDB_AUTHORITY_CONFLICT` e não sobrescreve o vencedor.
- Repetir a mesma decisão é idempotente. Trocar o vencedor exige justificativa e incrementa a revisão exatamente uma vez.
- A ativação em lote normaliza, ordena e remove domínios duplicados; qualquer domínio inválido ou incompatível aborta toda a chamada.

## Segurança

- Tabelas novas têm RLS habilitado e forçado desde a criação.
- `anon` não recebe privilégios sobre tabelas, visão ou RPCs.
- `authenticated` recebe somente leitura, filtrada pelo administrador singleton em AAL2.
- Escritas diretas não são concedidas nem ao administrador; ativações passam exclusivamente por RPCs `SECURITY DEFINER` com `search_path` vazio e guarda AAL2 duplicada.
- A auditoria registra jogo, domínio, fonte, submissão anterior/nova e revisão, mas não copia a justificativa textual.
- O estado derivado também exige administrador singleton em AAL2 e não expõe dados administrativos a outros usuários autenticados.

## Baseline compartilhada — 02/09/2026

Antes da aplicação, a base tinha 9 jogos, 2 imports confirmados e 19 auditorias administrativas. `game_data_submissions` estava vazia, não havia duplicidade ativa e as relações de capacidades, autoridade e estado derivado ainda não existiam. A migration remota mais recente era `20260902163902_game_data_submissions`, em PostgreSQL 17.6.

## Evidência pré-aplicação

- DDL integral e pgTAP focado executados juntos no Supabase compartilhado dentro de uma transação com rollback.
- Os 62 cenários foram percorridos; o primeiro ciclo corrigiu o plano declarado de 60 para 62. O banco desde zero revelou depois que `now()` é estável durante toda a transação e impedia uma segunda ativação válida feita no mesmo ciclo; a revisão passou a usar `clock_timestamp()` com avanço mínimo monotônico. O teste da proteção de submissão também passou a exercer o gatilho como proprietário, além do teste separado que comprova a negação da escrita direta ao cliente.
- A suíte cobre matriz fechada, RLS/grants, AAL2, fonte incapaz, submissão inativa, idempotência, compare-and-swap concorrente, troca justificada, proteção da submissão referenciada, lote atômico e os estados `ready`, `review`, `awaiting_primary_source` e `conflict`.
- Nenhuma linha ou objeto do banco compartilhado foi persistido pelo ensaio transacional.

## Aplicação e reconciliação final

Pendente do gate da branch. A migration só será aplicada uma vez, pelo mecanismo versionado, depois de `gate`, banco desde zero, preview e CodeQL aprovarem o commit funcional. Após a aplicação serão repetidos o pgTAP focado, a geração de tipos, os advisors e a reconciliação das contagens compartilhadas.
