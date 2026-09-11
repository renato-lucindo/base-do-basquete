# MVP-04 — Operação e publicação

Estado: DOING na branch feature/admin-workflow-improvements, PR draft #35.

## Unidade de agenda privada — 11/09/2026

- Atribuição explícita de inscrições confirmadas às posições do preset, sem alterar o blueprint ativo. Atribuições são imutáveis; troca/correção fica bloqueada até fluxo próprio.
- Preparações separadas dos jogos permitem reservar data/local com vagas pendentes sem produzir jogo ou placar fictício. Quando ambas as inscrições existem, a confirmação gera um único jogo estrutural com dois participantes derivados.
- Escritas AAL2 em RPC, RLS de leitura administrativa, grants mínimos, CAS na revisão, idempotência, auditoria e contexto de edição conferido no servidor. Jogos iniciados ou com submissões não são reagendados.
- Fonte estrutural explícita adicionada para jogos ainda sem submissão; fontes históricas e validação manual preservadas.
- UI protegida em /admin/competitions/:competitionId/schedule, ligada ao hub. Data exige offset explícito; banco verifica o período em America/Sao_Paulo, incluindo regras históricas do fuso.
- Migration gerada pelo CLI: 20260911031428_mvp04_private_scheduling.sql. Somente ensaiada em rollback; não aplicada persistentemente nesta unidade até CI verde.
- pgTAP focal 32/32 e regressão presets 35/35 passaram em rollback. Reconciliação: nove jogos, cinco revisões, edição 100 privada e nova tabela ausente após rollback.
- Contratos RPC adicionados aos tipos; regenerar tipos integrais após aplicação.

## Pendências do pacote

Confirmar CI, aplicar migration aprovada, regenerar tipos e validar a agenda no preview AAL2. Implementar progressão explícita por official_result principal ativo e publicação editorial versionada, com público lendo somente a última versão confirmada. Acrescentar teste concorrente da agenda e fluxo eliminatório ponta a ponta. Sem merge ou produção.
