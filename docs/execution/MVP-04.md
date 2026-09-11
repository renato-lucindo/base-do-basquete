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

## Pendências do pacote

Enviar a correção aditiva de índices, aguardar CI e aplicá-la. Validar a agenda no preview AAL2. Implementar progressão explícita por official_result principal ativo e publicação editorial versionada, com público lendo somente a última versão confirmada. Acrescentar teste concorrente da agenda e fluxo eliminatório ponta a ponta. Sem merge ou produção.
