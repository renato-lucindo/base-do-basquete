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

## Validação

- Gate local completo aprovado em 10/09/2026: formatação/lint, TypeScript, 29 arquivos/104 Vitest, quatro runbooks, build cliente/SSR e varredura de 493 arquivos sem segredos.
- QA interativo do accordion e gate consolidado do pacote ainda pendentes; esta unidade não conclui MVP-03.

## Próximo passo

Separar as rotas Competições/Equipes/Atletas/Segurança a partir de `app/routes/admin._index.tsx`, preservando guardas server-side e os fluxos existentes. Depois implementar presets versionados, compilação/ativação atômica e wizard de criação privada. Reconciliar Supabase antes de qualquer alteração de schema.
