# MVP-04 — Operação e publicação

Estado: DOING na branch feature/admin-workflow-improvements, PR draft #35.

## Unidade de agenda privada — 11/09/2026

- Atribuição explícita de inscrições confirmadas às posições do preset, sem alterar o blueprint ativo. Atribuições são imutáveis; troca/correção fica bloqueada até fluxo próprio.
- Preparações separadas dos jogos permitem reservar data/local com vagas pendentes sem produzir jogo ou placar fictício. Quando ambas as inscrições existem, a confirmação gera um único jogo estrutural com dois participantes derivados.
- Escritas AAL2 em RPC, RLS de leitura administrativa, grants mínimos, CAS na revisão, idempotência, auditoria e contexto de edição conferido no servidor. Jogos iniciados ou com submissões não são reagendados.
- Fonte estrutural explícita adicionada para jogos ainda sem submissão; fontes históricas e validação manual preservadas.
- UI protegida em /admin/competitions/:competitionId/schedule, ligada ao hub. Data exige offset explícito; banco verifica o período em America/Sao_Paulo, incluindo regras históricas do fuso.
- Migration gerada pelo CLI: 20260911031428_mvp04_private_scheduling.sql. O commit 48001d9 passou análise, banco, gate e upload na PR 35; a migration foi aplicada no Supabase como 20260911173435_mvp04_private_scheduling.
- pgTAP focal 32/32 e regressão presets 35/35 passaram em rollback; o pgTAP focal também passou após aplicação. Reconciliação: nove jogos, cinco revisões, edição 100 privada, zero atribuições e zero preparações persistentes.
- Tipos TypeScript integrais regenerados a partir do banco aplicado. O limite do gerador para null em argumentos RPC fica isolado por cast no boundary; a validação autoritativa permanece no PostgreSQL.
- Advisors confirmaram RLS nas tabelas novas. Os avisos SECURITY DEFINER das RPCs administrativas são intencionais, limitados ao singleton AAL2 e cobertos por negações. A auditoria de performance identificou nove FKs contextuais sem índice; a correção aditiva 20260911173639_mvp04_fk_covering_indexes.sql foi validada em rollback e aguarda o gate remoto antes da aplicação.

## Fechamento da agenda privada

A correção aditiva passou os quatro checks no commit 6d2738a e foi aplicada como 20260911174551_mvp04_fk_covering_indexes; o advisor não aponta mais FKs sem índice. Banco reconciliado com nove jogos, cinco revisões, fixture 100 privada, zero atribuições e zero preparações.

## Unidade de progressão eliminatória — 11/09/2026

- `admin_resolve_matchup` aceita apenas o confronto e a autoridade `official_result` esperada. Vencedor, perdedor e placares são calculados no PostgreSQL a partir do jogo final e da submissão principal ativa; o frontend nunca informa o classificado.
- Resolução imutável e idempotente, locks em ordem, RLS AAL2, auditoria e propagação das vagas de vencedor. `draft`/`review`, jogo não final, empate, preset não eliminatório e autoridade trocada são recusados.
- A progressão preenche o confronto dependente, mas não cria partida nem publica. A preparação final continua sendo ação administrativa explícita.
- UI da agenda mostra o resultado ativo, pede confirmação explícita e exibe a resolução. Erros internos são reduzidos a mensagens seguras.
- Migration `20260911174947_mvp04_knockout_progression.sql` e pgTAP focal `mvp04_matchup_progression.test.sql`: 28/28 em transação com rollback, incluindo duas semifinais até final pronta. Gate local: 245 Vitest, lint, tipos, build, runbooks e scan de 521 arquivos.
- O commit `40dd103` passou os quatro checks remotos; a migration foi aplicada como `20260911180212_mvp04_knockout_progression`, o pgTAP persistente passou 28/28 e os tipos integrais foram regenerados.

## Unidade de publicação editorial versionada — 11/09/2026

- Cada confirmação cria um snapshot imutável e numerado. A coluna legada `status` foi preservada, mas a leitura anônima exige o ponteiro `current_publication_id` e fingerprints coincidentes de inscrições, elencos e jogos.
- Uma alteração esportiva posterior fica privada até nova confirmação. Jogos agendados preservam placares nulos; nenhuma publicação automática ocorre quando a data de início chega.
- Revisão e publicação são RPCs server-side AAL2, com confirmação explícita, CAS de versão, idempotência, auditoria e bloqueios para edição incompleta. RLS e grants impedem mutação anônima e exposição de versões antigas.
- A UI administrativa ganhou revisão/publicação no hub e o público consome somente o snapshot confirmado. O fallback de rollout aceita exclusivamente `PGRST202` enquanto a RPC ainda não existe; demais erros falham fechados.
- Migration `20260911180356_mvp04_versioned_publication.sql` e pgTAP `mvp04_versioned_publication.test.sql`: 33/33 em rollback. Gate local: 38 arquivos/261 Vitest, tipos, lint, build, runbooks e varredura de 528 arquivos.
- No head `09a992d`, `gate`, banco desde zero com 743 pgTAP e prova de concorrência, `upload`/smoke do preview e `analyze` passaram. As regressões encontradas pelo CI foram corrigidas sem afrouxar a autoridade do snapshot: seed pós-fatos, fixtures históricas versionadas e confronto de camisa com dois participantes.
- A aplicação no Supabase compartilhado foi recusada pela proteção de risco antes de qualquer DDL. Estado reconciliado: quatro competições publicadas, uma draft, nove jogos, doze inscrições e migration ainda ausente. É necessária autorização explícita para criar as tabelas/policies e retropreencher uma versão imutável para as quatro competições publicadas.

## Pendências do pacote

Após autorização explícita, aplicar somente a migration de publicação no Supabase compartilhado, regenerar tipos integrais, repetir 33 pgTAP persistentes, advisors e reconciliação. Depois validar publicação no preview AAL2, acrescentar o teste concorrente específico da agenda e os smokes público/privado. Sem merge ou produção.
