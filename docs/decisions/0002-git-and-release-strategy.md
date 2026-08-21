# ADR 0002 — Estratégia de Git e release

- Status: aceito
- Data: 2026-08-21

## Decisão

- Repositório privado `base-do-basquete`.
- Branch principal `main` protegida.
- Uma branch curta `wp-XX-*` e um PR por pacote vertical.
- Commits após unidades funcionais coerentes.
- Push exige testes aplicáveis e varredura de segredos.
- PR começa como draft durante implementação e só pode ser integrado com gate consolidado verde.
- Branches WP publicam apenas previews.
- Produção é publicada exclusivamente por `main` protegida ou versão marcada.
- WIP nunca é integrado em `main` nem publicado em produção.

## Gate consolidado

Instalação pelo lockfile, formatação, lint, typecheck, testes afetados, testes SQL/RLS, build, dependências, segredos e smoke de preview quando aplicável.
