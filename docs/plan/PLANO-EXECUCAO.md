# Plano de execução condensado

## Estados

`BACKLOG` → `READY` → `DOING` → `DONE` ou `BLOCKED`.

Somente dependência real bloqueia um pacote. O estado e as evidências devem ser mantidos no GitHub, não neste ZIP.

## WP-00 — Repositório e decisões iniciais

**Dependências:** nenhuma.

Criar o repositório privado, documentação inicial, estratégia de branches, proteção contra segredos, ADR da stack e estrutura do monólito modular. Importar este plano para `docs/plan/` e registrar que o plano original é referência, não backlog.

**Concluído quando:** repositório acessível, branch principal protegida de forma compatível com automação, stack fixada e nenhum segredo versionado.

## WP-01 — Ambientes cloud

**Dependências:** WP-00.

Criar e conectar Cloudflare, Supabase e GitHub. Preparar preview/staging e produção, usando planos gratuitos enquanto suficientes. Configurar variáveis e secrets nos cofres corretos, sem valores no repositório.

**Concluído quando:** GitHub consegue construir e publicar um Worker mínimo em preview, e os ambientes Supabase necessários estão identificados e acessíveis.

## WP-02 — Scaffold, CI e preview contínuo

**Dependências:** WP-00, WP-01.

Criar a aplicação React Router full-stack com TypeScript strict, Vite e Cloudflare Workers. Configurar estrutura modular, lint, formatação, testes, build, CodeQL, Dependabot, varredura de segredos e preview por PR.

**Concluído quando:** um PR altera a aplicação, passa pelo gate e produz preview remoto reproduzível.

## WP-03 — Autenticação do administrador único

**Dependências:** WP-01, WP-02.

Implementar Supabase Auth para uma única conta administrativa, sem cadastro público, convites, RBAC, gestão de usuários ou papéis. Exigir MFA, `aal2`, sessão segura, autorização server-side de `/admin`, RLS e auditoria essencial. Criar a conta única pelo ambiente autorizado e manter sua autorização em fonte controlada pelo backend/banco.

**Concluído quando:** testes diretos provam bloqueio para anônimo, outra identidade autenticada e conta administrativa em `aal1`; somente a conta administrativa autorizada em `aal2` acessa e grava o permitido.

## WP-04 — Modelo canônico, migrations e RLS

**Dependências:** WP-02, WP-03.

Criar do zero o modelo de séries, edições, categorias, equipes, jogadores, inscrições, elencos, jogos, períodos, relacionados, estatísticas, importações, colocações e conquistas. Adicionar integridade, índices iniciais, RLS, GRANTs, tipos gerados, seeds remotos de staging e testes SQL.

**Concluído quando:** CI aplica todas as migrations desde zero em ambiente remoto seguro, executa testes SQL/RLS e gera tipos sem divergência.

## WP-05 — Contexto e navegação pública

**Dependências:** WP-04.

Entregar resolução de contexto, rotas públicas, 404, raiz para contexto recente, persistência do último contexto, seletor, header, breadcrumb e links contextuais.

**Concluído quando:** o preview navega entre duas edições e categorias sem mistura de dados, com E2E cobrindo combinações válidas e inválidas.

## WP-06 — Hub administrativo, equipes e elencos

**Dependências:** WP-03, WP-04.

Entregar dashboard, hub da edição, cadastro de equipes/jogadores, inscrições, estados, editor de elenco e histórico de camisas. Aplicar transações e regras de exclusividade no backend e banco.

**Concluído quando:** administrador autorizado gerencia uma edição completa e testes diretos impedem dupla equipe, camisa inválida, duplicidade e acesso indevido.

## WP-07 — Jogos e súmula manual

**Dependências:** WP-06.

Entregar criação de jogo, seleção de equipes, relacionados, doze slots, N/A, sugestões, grade de períodos, arremessos, pontos, faltas, GD, OT e salvamento transacional idempotente.

**Concluído quando:** um jogo completo é criado e encerrado no preview, falhas não deixam dados parciais e empate final é bloqueado.

## WP-08 — Página do jogo e estatísticas

**Dependências:** WP-05, WP-07.

Entregar página pública do jogo, agregações isoladas, tabelas simples/avançadas, totais/médias, filtros e comparação acessível. Começar sem cache distribuído.

**Concluído quando:** fixtures de duas edições produzem resultados corretos, não há mistura de contexto e o benchmark inicial registra p50/p95.

## WP-09 — Importação de boxscore PDF

**Dependências:** WP-06, WP-07, WP-08.

Entregar upload seguro, hash, duplicidade, extração da camada de texto, parser, validação, associação de jogadores, revisão administrativa, rascunho, auditoria e commit transacional. Implementar exclusivamente o modelo definido em `MODELO-BOXSCORE-FIBA.md`, usando os dois PDFs incluídos como fixtures. Não implementar OCR nesta etapa.

**Concluído quando:** os dois PDFs oficiais são importados pelo mesmo contrato normalizado, ambiguidade exige revisão, duplicata é recusada, PDF sem texto segue para entrada manual e nenhuma falha deixa jogo parcial.

## WP-10 — Histórico, colocações e conquistas

**Dependências:** WP-06, WP-08.

Entregar confirmação de colocações, conquistas de equipes e jogadores, consultas históricas e exibição nos perfis.

**Concluído quando:** conquistas aparecem somente após confirmação autorizada e respeitam edição, equipe e participação do jogador.

## WP-11 — Desempenho e cache condicionado

**Dependências:** WP-08, WP-09.

Medir consultas com volume representativo, revisar planos e índices e estabelecer metas. Adicionar adaptador de cache e invalidação contextual somente se os resultados demonstrarem necessidade.

**Concluído quando:** metas e medições são registradas; qualquer índice ou cache novo possui evidência e não altera resultados.

## WP-12 — Observabilidade e recuperação

**Dependências:** WP-07, WP-09, WP-10.

Instrumentar autenticação, importação, elenco e súmula com correlation ID, duração, resultado e logs redigidos. Criar runbooks de incidente, revogação de segredo, backup, restauração e rollback.

**Concluído quando:** uma operação pode ser rastreada sem expor payload sensível e o procedimento de recuperação é testado em staging.

## WP-13 — Release de produção

**Dependências:** WP-03 a WP-12.

Executar advisors, reconciliação, smoke público, smoke administrativo, revisão de rastreabilidade, deploy gradual e observação. Corrigir automaticamente problemas reversíveis antes de prosseguir.

**Concluído quando:** produção está publicada, smokes passam, métricas permanecem dentro das metas e existe versão anterior recuperável.

## Evoluções posteriores, fora da primeira temporada

- Múltiplos administradores e convites.
- RBAC, papéis especializados e gestão de permissões.
- Painel de usuários, transferência de titularidade e auditoria administrativa avançada.

## Paralelismo permitido

- Após WP-04, WP-05 e a estrutura inicial de WP-06 podem avançar em paralelo se não editarem os mesmos módulos.
- Após WP-07, a página pública de WP-08 e a preparação não funcional de WP-09 podem avançar em paralelo.
- WP-10 e WP-12 podem ser desenvolvidos em paralelo após suas dependências.
- Arquivos centrais de migration, autenticação, contratos e tipos gerados têm um único responsável por vez.
