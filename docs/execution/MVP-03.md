# MVP-03 — Administração e criação por presets

## Estado

`DOING` na branch `feature/admin-workflow-improvements`, PR draft #35.

## Baseline

- Head de partida `3658f59`, worktree limpo.
- Checks `gate`, `database`, `analyze` e `upload` aprovados no fechamento documental do MVP-02.
- Não houve nova migration nem escrita no Supabase nesta unidade.

## Unidade implementada

- Hub com accordion controlado: todas as equipes recolhidas inicialmente, apenas uma aberta e retorno ao elenco salvo pelo parâmetro existente `savedRoster`.
- Seções Elenco/Situação/Resultado mostram um formulário por vez; componentes permanecem montados para preservar estado ao alternar.
- Cabeçalho acionável por teclado, relações ARIA, situação em português e estilos móveis com quebra de texto.
- A ação de súmula agora informa corretamente que seleciona um jogo existente.
- Allowlist desta unidade: componente/teste do accordion, rota do hub, CSS, fila e documentação do pacote.

## Segunda unidade — áreas administrativas

- `/admin` redireciona após AAL2 para `/admin/competitions`; equipes, atletas e segurança possuem rotas próprias e navegação compartilhada com o hub.
- Competições têm busca server-side, filtros por ano/situação e naipe explícito; formulários globais saíram desta página.
- Equipes e atletas têm buscas limitadas a 50 resultados; cada action aceita somente sua própria operação e preserva AAL2, mesma origem, CSRF e as validações/RPCs existentes.
- Segurança reúne estado da sessão e encerramento de sessões pelo endpoint existente.
- Allowlist ampliada para as novas rotas, `app/routes.ts`, entrada administrativa, navegação compartilhada e testes de isolamento das áreas.
- Gate local aprovado: 30 arquivos/117 Vitest, formatação/lint, tipos, runbooks, builds e scan de segredos. Os 13 testes novos cobrem negação antes de consultar/gravar, origem, CSRF, isolamento de intents e continuidade do cadastro privado.
- Commit `bc60d76` enviado somente à branch da PR #35. CI/database `34473818965`, preview `34473818938` e CodeQL `34473818894` aprovados.
- Reconciliação remota somente leitura: 4 revisões de regulamento, 9 jogos e `game_active_data_sources` disponível. O smoke administrativo foi redirecionado ao login: MFA renovado é necessário para QA interativo, mas não para desenvolver os presets localmente.

## Validação

- Gate local completo aprovado em 10/09/2026: formatação/lint, TypeScript, 29 arquivos/104 Vitest, quatro runbooks, build cliente/SSR e varredura de 493 arquivos sem segredos.
- QA interativo do accordion e gate consolidado do pacote ainda pendentes; esta unidade não conclui MVP-03.

## Próximo passo

Validar as áreas e o accordion no preview. Implementar presets versionados, compilação/ativação atômica e wizard de criação privada, reutilizando a estrutura aditiva do MVP-01. Reconciliar Supabase antes de qualquer alteração de schema. O pacote permanece em execução até seu gate completo.
