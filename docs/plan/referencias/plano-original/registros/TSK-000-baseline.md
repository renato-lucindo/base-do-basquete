# Registro de execução — TSK-000

- Estado: `BLOQUEADA`
- Data da verificação: `2026-07-30T09:00:54-03:00`
- Repositório esperado: `renato-lucindo/site-bask-8dc77042`
- Branch esperada pelo plano: `main`

## Motivo do bloqueio

Não existe checkout Git utilizável na pasta desta execução. Foram localizadas
duas cópias locais que apontam para o repositório esperado, porém nenhuma
corresponde a uma árvore limpa em `main`. Conforme o passo 5 da tarefa, nenhuma
delas foi adotada como baseline e a execução foi interrompida antes de qualquer
alteração de produto.

## Cópias locais encontradas

### Candidata 1

- Caminho: `/workspace/scratch/4286e9fe0b20/site-bask`
- Remote `origin`: `https://github.com/renato-lucindo/site-bask-8dc77042.git`
- Branch: `codex/secure-boxscore-import`
- HEAD: `b3fa9c95a0fd1ee238fbc47a9200293c00d4496d`
- Relação com upstream: um commit à frente de
  `origin/codex/secure-boxscore-import`
- Mudança preexistente: `.env` modificada
- Referência local `origin/main`: indisponível

### Candidata 2

- Caminho: `/workspace/scratch/79915ed39153/site-bask`
- Remote `origin`: `https://github.com/renato-lucindo/site-bask-8dc77042.git`
- Branch: `codex/secure-boxscore-import-publish`
- HEAD: `22468a82fc8caf0a756692bb0759a49a7d51bd14`
- Referência local `origin/main`:
  `cbd2faeff5ccd997fa2be84e34d87328da910482`
- Mudanças preexistentes não rastreadas:
  - `supabase/.temp/`
  - `supabase/functions/temporary-login/`
  - `supabase/migrations/20260728170822_temporary_homologation_access.sql`
  - `supabase/migrations/20260728171849_harden_temporary_homologation_credentials.sql`

## Ambiente e comandos do projeto

- Node: `v24.14.0`
- Gerenciador identificado: npm, por `package-lock.json`
- npm: `11.9.0`
- Supabase CLI local: indisponível
- Supabase CLI global: indisponível
- `lint`: `eslint .`
- `test`: `node --test --experimental-strip-types tests/*.test.ts`
- `build`: `vite build`

Os comandos são idênticos nos dois `package.json` inspecionados.

## Critérios de aceite

- Baseline única com repositório, branch, SHA, data e comandos: **não atendido**;
  há duas cópias divergentes e nenhuma está limpa em `main`.
- Nenhum arquivo de produto alterado: **atendido**.
- Mudanças preexistentes preservadas: **atendido**.

## Autorização necessária

Indicar qual checkout/branch deve ser adotado ou disponibilizar uma cópia limpa
do `main`. Caso uma das árvores com mudanças preexistentes seja intencional,
autorizar explicitamente seu uso como baseline.
