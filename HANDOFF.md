# HANDOFF — Base do Basquete

> Estado persistente para continuidade entre sessões, contas e agentes Codex. Atualize fatos e evidências; não registre segredos.

## 1. Objetivo

Construir do zero e publicar a **Base do Basquete**, aplicação web de dados e histórico do basquete, com administração de campeonatos, equipes, jogadores, elencos, jogos, estatísticas, colocações, conquistas, súmula manual e importação de um único formato de boxscore PDF.

## 2. Estado atual

- Fase: WP-00 a WP-13 concluídos e integrados; release de produção encerrada.
- Status geral: `DONE`; produção pública, métricas, logs, rollout e smoke administrativo `aal2` aprovados. O responsável recusou conscientemente a rotação recomendada e aceitou o risco residual da senha exibida na saída técnica de inspeção.
- Repositório GitHub: privado em `renato-lucindo/base-do-basquete`.
- Branch atual: `codex/wp-13-final-handoff`, exclusiva para registrar este estado pós-merge.
- Evidência final do WP-13 integrada em `main`: `2e7e530` (`WP-13 — Concluir release de produção (#22)`).
- Aplicação publicada: release `v1.0.3` saudável em `https://base-do-basquete-prod.renato-lucindo-jr.workers.dev`; preview fixo também restaurado e saudável.
- Cloudflare: produção ativa em 100% na candidata `c98935fa`; versão anterior `d59fd181` preservada para rollback; logs 179 sucessos/0 erros na janela validada.
- Supabase: projeto `base-do-basquete` criado na organização `renato-lucindo`, região `sa-east-1`, custo informado de US$ 0/mês e estado saudável.
- Domínio próprio: não definido e fora do escopo atual.
- Administradores na primeira temporada: uma única conta.

## 3. Decisões consolidadas

- Nome público: **Base do Basquete**.
- Reconstrução greenfield; não procurar nem depender do repositório antigo.
- GitHub é a fonte da verdade; infraestrutura e artefatos importantes não podem existir apenas localmente.
- Desenvolvimento ocorre em branch própria por WP; WIP pode ser enviado somente para essa branch, merge exige gate aprovado e produção parte apenas da branch principal protegida ou de versão marcada.
- Cloudflare Workers hospeda preview e produção.
- Supabase fornece PostgreSQL, Auth e Storage.
- Arquitetura inicial: monólito modular full-stack em TypeScript estrito.
- Frontend é não confiável; regras e escritas são autoritativas no backend/banco.
- Primeira temporada com um único administrador, MFA e `aal2`.
- Multiadmin, convites, RBAC e gestão de usuários ficam para fase futura.
- Importação restrita ao único modelo FIBA/Genius Sports documentado, usando os dois PDFs fornecidos como fixtures.
- OCR open source é alternativa futura e não deve ser pesquisado ou implementado agora.
- Domínio será decidido posteriormente; usar URLs temporárias das plataformas.

## 4. Concluído

- [x] Plano greenfield condensado em pacotes verticais.
- [x] Arquitetura cloud-first definida.
- [x] Regras de autonomia e segurança definidas.
- [x] Nome **Base do Basquete** definido.
- [x] Escopo de administrador único definido.
- [x] Formato único de boxscore definido.
- [x] Dois PDFs de referência incorporados ao plano.
- [x] OCR registrado apenas como possibilidade futura.
- [x] Repositório remoto privado criado e baseline publicada.
- [x] Repositório Git local inicializado em branch própria do WP-00.
- [x] Plano importado e ordem de leitura obrigatória concluída.
- [x] ADRs iniciais, política de segurança, `.gitignore` e baseline de varredura de segredos criados.
- [x] Aplicação implementada integralmente; WP-00 a WP-13 concluídos e produção validada.
- [x] Serviços cloud básicos configurados.
- [x] Scaffold React Router full-stack em Cloudflare Workers.
- [x] CI, preview por PR, Dependabot e CodeQL com SARIF configurados.
- [x] Fluxo server-side de login, matrícula/desafio TOTP e logout implementado.
- [x] Migration de administrador singleton, RLS `aal2` e auditoria aplicada/validada.
- [x] Conta administrativa real criada e registrada no singleton controlado pelo banco.
- [x] MFA TOTP matriculado e sessão real comprovada em `aal2`.
- [x] Modelo canônico de campeonatos, edições, equipes, atletas, inscrições, elencos, jogos, períodos e colocações aplicado no Supabase.
- [x] Placar e conquistas modelados como visões derivadas, sem estado duplicado gravável.
- [x] Importação limitada ao boxscore FIBA/Genius Sports com hash SHA-256 único e bucket PDF privado.
- [x] RLS pública somente para dados publicados; escritas autenticadas exigem administrador singleton em `aal2` e `DELETE` não é concedido.
- [x] Seed de staging não público, tipos TypeScript gerados e 34 testes SQL aprovados no banco remoto.

## 5. Fechamento do WP-13

WP-13 está na branch própria. Advisors não apontam vulnerabilidade de schema acionável; a reconciliação confirmou singleton/MFA, RLS integral e ausência de órfãos. O environment GitHub `production` recebeu três bindings próprios sem exposição. O workflow agora exige secrets declarados, envia code/secrets atomicamente, executa smoke/benchmark e permite upload de candidata para rollout gradual. Gate local inicial passou com 43 testes.

O primeiro dispatch foi recusado com HTTP 422 antes de executar qualquer job ou deploy: o GitHub marcou o workflow inválido porque o comando inline de limpeza continha `: ` em um scalar YAML. A correção foi integrada pela PR #19 e a tag imutável `v1.0.1` aponta para esse commit; `v1.0.0` foi preservada como candidata não implantada.

O primeiro job válido, execução #32736328449, passou build e deploy, mas o smoke bloqueou a liberação: o Cloudflare Vite Plugin gerou uma configuração redirecionada com o ambiente top-level de preview, apesar de `wrangler deploy --env production`. Assim, nenhum Worker de produção foi criado; o Worker fixo de preview recebeu a versão nova e uma nova `SESSION_SECRET`, sem exposição de valores. A PR #20 integrou a correção que seleciona `CLOUDFLARE_ENV` antes do build, valida nome/`APP_ENV` no artefato e restaura preview/secrets atomicamente.

A execução #32737628228 restaurou o preview e `/health` confirmou `environment=preview`. O primeiro deploy de produção correto recebeu 404 durante a propagação do novo hostname; a PR #21 integrou retry limitado para 404/502/503/504. A release `v1.0.3` passou integralmente no workflow #32738728739. A candidata foi exercitada em 10%/90%, passou 50/50 health requests e smokes, foi promovida a 100% e manteve a versão anterior recuperável. O benchmark pós-promoção ficou em p95 263,6 ms para jogadores e 337,0 ms para jogo FIBA. Observability confirmou 0 erros e log customizado somente com a allowlist operacional.

O smoke administrativo final confirmou sessão `aal2`, dashboard, hub protegido, logout e redirecionamento anônimo. A auditoria registrou `mfa_verified`, `admin_access` e `logout`. Após o logout, o gerenciador do navegador preencheu automaticamente a senha e ela apareceu na saída técnica da inspeção; a sessão já estava encerrada e nenhum valor foi persistido no repositório ou nos serviços. A rotação foi recomendada, mas o responsável recusou conscientemente a alteração e aceitou o risco residual. Essa decisão não reduz MFA, `aal2`, RLS, sessão segura ou autorização server-side.

## 6. Próximo passo exato

1. Não há implementação pendente no plano atual. Na próxima alteração autorizada, ler este handoff e confirmar `main` no GitHub e `/health` com `environment=production` e `status=ok`.
2. Criar uma nova branch curta `codex/wp-*` a partir da `main` atual; não reutilizar as branches dos pacotes encerrados.
3. Se a mudança for operacional ou resposta a incidente, seguir o runbook correspondente em `docs/runbooks/` e validar a recuperação antes de alterar produção.

### Primeiros arquivos a abrir

- `AGENTS.md`
- `HANDOFF.md`
- `docs/plan/README.md`
- `docs/plan/PROMPT-MESTRE-IDE.md`
- `docs/plan/PLANO-EXECUCAO.md`

### Resultado esperado do próximo passo

Produção publicada na URL temporária do Cloudflare, todos os smokes/métricas aprovados, versão anterior recuperável e documentação final atualizada.

## 7. Pacotes de trabalho

| Pacote | Estado | Observação |
| --- | --- | --- |
| WP-00 — Repositório e decisões iniciais | `DONE` | Baseline em `main`; proteção obrigatória indisponível no plano gratuito do repositório privado |
| WP-01 — Ambientes cloud | `DONE` | PR #2 integrada; preview bootstrap saudável |
| WP-02 — Scaffold, CI e preview | `DONE` | PR #3 integrada; preview por PR validado |
| WP-03 — Administrador único | `DONE` | PR #8 integrada; conta singleton, TOTP real, `aal2`, RLS e gate aprovados |
| WP-04 — Modelo canônico | `DONE` | PR #9 integrada; CI aplicou migrations/seed desde zero e pgTAP passou |
| WP-05 — Contexto e navegação pública | `DONE` | PR #10 integrada; E2E no preview e navegador real aprovados |
| WP-06 — Hub administrativo e elencos | `DONE` | PR #11 integrada no commit `07454a1`; todos os gates aprovados |
| WP-07 — Jogos e súmula manual | `DONE` | PR #12 integrada por squash no commit `49890f6`; produção não publicada |
| WP-08 — Página do jogo e estatísticas | `DONE` | PR #13 integrada por squash no commit `0cdd560`; produção não publicada |
| WP-09 — Importação de boxscore PDF | `DONE` | PR #14 integrada por squash no commit `91c59dd`; produção não publicada |
| WP-10 — Histórico, colocações e conquistas | `DONE` | PR #15 integrada por squash no commit `191069c`; produção não publicada |
| WP-11 — Desempenho e cache condicionado | `DONE` | PR #16 integrada por squash no commit `572127c`; cache dispensado por evidência |
| WP-12 — Observabilidade e recuperação | `DONE` | PR #17 integrada por squash no commit `526e900`; produção não publicada |
| WP-13 — Release de produção | `DONE` | `v1.0.3` ativa; rollout, métricas, logs, smoke público e smoke administrativo `aal2` aprovados; risco residual aceito pelo responsável |

## 8. Arquivos e referências importantes

| Caminho esperado | Função |
| --- | --- |
| `AGENTS.md` | Regras permanentes para o Codex |
| `HANDOFF.md` | Estado e continuidade |
| `docs/plan/README.md` | Entrada do plano ativo |
| `docs/plan/PROMPT-MESTRE-IDE.md` | Mandato de execução |
| `docs/plan/PLANO-EXECUCAO.md` | Pacotes e critérios de conclusão |
| `docs/plan/ARQUITETURA-SEGURANCA.md` | Stack e regras obrigatórias |
| `docs/plan/MODELO-BOXSCORE-FIBA.md` | Contrato do único formato importado |
| `docs/plan/FUTURO-OCR.md` | Alternativa futura, fora do escopo |
| `docs/plan/referencias/modelos-boxscore/` | Dois PDFs usados como fixtures |

## 9. Serviços e variáveis

Serviços configurados: repositório privado e environments no GitHub, Workers de preview e produção no Cloudflare e projeto gratuito saudável no Supabase. A produção `v1.0.3` está publicada na URL temporária da plataforma.

Registre aqui somente nomes de variáveis quando forem definidos. Nunca registre valores, tokens, cookies, senhas, chaves privadas, URLs com credenciais ou connection strings.

```env
APP_ENV
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
SESSION_SECRET
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

## 10. Comandos do projeto

- `npm ci` — instalação reproduzível pelo lockfile.
- `npm run format:check` — valida formatação com Biome.
- `npm run lint` — valida regras estáticas com Biome.
- `npm run typecheck` — gera tipos e executa TypeScript strict.
- `npm test` — executa Vitest.
- `npm run build` — gera builds cliente e SSR.
- `npm run scan:secrets` — varre arquivos versionáveis por credenciais conhecidas.
- `npm run check:runbooks` — valida conteúdo mínimo dos runbooks operacionais.
- `npm run check` — gate completo local e remoto.
- `npm run deploy:preview` — deploy do Worker de preview.
- `npm run deploy:production` — deploy de produção; permitido somente a partir de `main`.

## 11. Testes e evidências

- Testes executados: `npm run check` aprovado; 6 testes Vitest; quatro cenários RLS diretos aprovados; smokes admin/CSRF/health aprovados.
- Provisionamento real: exatamente 1 usuário Auth ativo, 1 vínculo em `private.admin_accounts`, 1 fator TOTP verificado e 1 sessão ativa com método `totp`; correspondência singleton confirmada.
- Auditoria real: 2 eventos `mfa_verified` registrados pelo fluxo; a conta real em `aal2` é reconhecida e enxerga a auditoria sob RLS.
- Negação real: a mesma identidade simulada em `aal1` é reconhecida como singleton, mas `is_current_admin_aal2()` retorna falso e nenhuma linha de auditoria fica visível.
- Gate final local: Biome em 34 arquivos, TypeScript strict, 4 arquivos/6 testes Vitest, builds cliente e SSR e varredura de 233 arquivos aprovados; `npm ci` auditou 175 pacotes com 0 vulnerabilidades.
- Dependências: `npm install` auditou 175 pacotes e não encontrou vulnerabilidades.
- GitHub Actions: CI #10, preview #9 e CodeQL #10 aprovados na PR #8.
- CodeQL: SARIF de 70.839 bytes preservado por 14 dias; upload ao Code Scanning indisponível no plano atual do repositório privado.
- Falhas conhecidas: nenhuma funcional no WP-03.
- Incidente de CI resolvido: o teste de adulteração alterava o último caractere Base64URL, que podia preservar os bytes decodificados por causa do padding; agora altera deterministicamente o meio do ciphertext autenticado.
- Evidências de pacotes: registrar em `docs/execution/WP-XX.md`.
- WP-12 gate local: Biome em 69 arquivos, TypeScript strict, 12 arquivos/43 testes Vitest, quatro runbooks, builds cliente/SSR e scan de 298 arquivos aprovados.
- WP-12 staging: cópia lógica temporária preservou 3/3 linhas e checksum; rollback real do Worker detectou incompatibilidade pelo smoke público e restauração da candidata recuperou `/health` e HTTP 200.
- WP-12 observabilidade: eventos `health` e `auth` conferidos ao vivo no Worker fixo de staging; o log customizado contém somente a allowlist operacional e nenhum payload da aplicação.
- WP-13 pré-release: 1 usuário/1 MFA/1 admin, 4 competições, 6 equipes, 44 atletas, 9 jogos, 2 imports confirmados, 2 PDFs privados, 23 eventos de auditoria, RLS integral e 0 órfãos.
- WP-13 gate local inicial: Biome em 71 arquivos, TypeScript strict, 43 Vitest, quatro runbooks, build e scan de 301 arquivos aprovados.
- WP-13 smoke administrativo em produção: sessão `aal2`, dashboard e hub protegido aprovados; logout e nova tentativa anônima redirecionaram para `/admin/login`; auditoria confirmou `mfa_verified`, `admin_access` e `logout`.
- Decisão de risco: senha administrativa preenchida automaticamente apareceu na saída técnica da inspeção pós-logout. Sessões encerradas, nenhuma persistência em código ou serviços e rotação recomendada; o responsável recusou conscientemente a alteração e aceitou o risco residual.
- Recovery não utilizado: Supabase Auth confirmou `user_recovery_requested`, `/recover` HTTP 200 e envio do e-mail `recovery`; o responsável pode descartar a mensagem.
- WP-13 gate após o incidente: Biome em 72 arquivos, TypeScript strict, 12 arquivos/43 Vitest, quatro runbooks, builds cliente/SSR e scan de 303 arquivos aprovados; nenhum segredo persistido no Git.
- WP-04 SQL: 34/34 asserts aprovados em rollback integral e novamente no esquema remoto persistido; todas as 19 tabelas de aplicação com RLS.
- WP-04 advisors: nenhum item de performance acionável; avisos remanescentes são índices recém-criados ainda sem uso, schema privado sem policy por desenho e proteção de senha vazada disponível apenas no plano pago.
- WP-04 gate local: Biome em 34 arquivos, TypeScript strict, 4 arquivos/6 testes Vitest, builds cliente/SSR e varredura de 238 arquivos aprovados.
- WP-04 gate remoto: PR #9 com CI/gate, database desde zero, preview e CodeQL aprovados; merge `b92c5c1`.
- WP-05 staging: consulta sob papel `anon` confirmou 3 contextos, 2 anos, 2 categorias, 2 equipes, 2 atletas e 3 jogos.
- WP-05 gate local inicial: Biome em 43 arquivos, TypeScript strict, 6 arquivos/12 testes Vitest, builds cliente/SSR e scan de 247 arquivos aprovados.
- WP-05 gate remoto: CI/gate, database desde zero, preview com smoke contextual e CodeQL aprovados na PR #10.
- WP-05 navegador: troca 2026/Sub-15 → Sub-17, recurso Jogos, voltar/avançar, reload, troca para 2025, 404 inválido e `/admin/login` validados.
- WP-05 merge: PR #10 integrada por squash no commit `85c6913`; produção não publicada.
- WP-06 banco: 16 asserts de inscrição/elenco e 5 asserts de histórico de camisas aprovados em rollback e no staging persistido.
- WP-06 gate local: Biome em 46 arquivos, TypeScript strict, 7 arquivos/14 testes Vitest, builds cliente/SSR e scan de 255 arquivos aprovados.
- WP-06 gate remoto inicial: PR #11 com CI/gate, database desde zero, preview/smoke público e CodeQL aprovados no commit `25fae07`.
- WP-06 navegador: sessão real no host `pr-11`, selo `AAL2`, dashboard e hub 2025/Sub-15 validados; reenvio idempotente do elenco com camisa `00` concluído sem erro.
- WP-06 auditoria real: evento `roster_replaced` append-only registrado para a inscrição com uma entrada, confirmado diretamente no banco.
- WP-06 merge: PR #11 integrada por squash no commit `07454a1`; produção não publicada.
- WP-07 banco: migration transacional e 19 pgTAP aprovados em rollback integral e novamente no staging persistido.
- WP-07 gate local final: Biome em 50 arquivos, TypeScript strict, 8 arquivos/26 testes Vitest, builds cliente/SSR e scan de 264 arquivos aprovados.
- WP-07 advisors: FK `games.created_by` indexada; nenhum item acionável de segurança/performance permanece além dos avisos já documentados e índices novos sem uso.
- WP-07 gate remoto: CI executou migrations/seed desde zero, todas as suítes pgTAP e o gate da aplicação; preview, smoke público automatizado e CodeQL aprovados na PR #12.
- WP-07 navegador: sessão real `aal2`, editor com duas equipes/elencos, placar ao vivo, encerramento e detalhe público aprovados. O primeiro smoke revelou `/games/:id` inválido; a correção para `/jogos/:id` recebeu teste de regressão e o segundo smoke redirecionou corretamente.
- WP-07 auditoria real: `SMOKE-WP07-02` persistiu como `manual`/`final`, placar derivado 3×1, 4 períodos, 2 relacionados, 8 linhas de estatísticas e um evento append-only `manual_scoresheet_saved` correspondente.
- WP-07 merge: PR #12 integrada por squash no commit `49890f6`; produção não publicada.
- WP-08 banco: views `security_invoker` por jogo/edição aplicadas; fixtures `STATS-01` de 2025 e 2026 isoladas; 14 pgTAP aprovados no staging.
- WP-08 gate local: Biome em 55 arquivos, TypeScript strict, 9 arquivos/32 testes Vitest, builds cliente/SSR e scan de 271 arquivos aprovados.
- WP-08 desempenho inicial do banco: detalhe de jogo filtrado executou em 1,408 ms no staging com índices contextuais existentes.
- WP-08 gate remoto: CI/database desde zero, preview/smoke automatizado e CodeQL aprovados na PR #13.
- WP-08 smoke HTTP: Jogadores 2025/2026, tabela/comparação, jogos 45/46, boxscore e placares isolados 2×3/8×6 aprovados; contexto inválido respondeu 404.
- WP-08 benchmark HTTP no Worker, 30 amostras: Jogadores p50 702,2 ms / p95 793,6 ms; jogo p50 979,5 ms / p95 1.083,0 ms.
- WP-08 merge: PR #13 integrada por squash no commit `0cdd560`; produção não publicada.
- WP-09 parser: os dois PDFs oficiais geram o mesmo contrato; ALC 58–67 AVABES (5205808) e IVV 93–39 CAC (5205822) reconciliados.
- WP-09 banco: migrations de importação/limite/funções privadas aplicadas; 23 pgTAP aprovados no remoto e novamente pelo CI desde zero.
- WP-09 gate local: Biome, TypeScript strict, 11 arquivos/39 testes Vitest, builds cliente/SSR Worker, scan de 283 arquivos e auditoria npm com zero vulnerabilidades.
- WP-09 remoto: PR #14 com `gate`, `database`, `upload` e `analyze` aprovados no commit `f2ea9d7`; smoke público contextual do preview aprovado.
- WP-09 navegador: sessão real `aal2`; ALC 58–67 AVABES e IVV 93–39 CAC importados, revisados e exibidos publicamente; duplicata recusada por hash.
- WP-09 reconciliação: 2 importações confirmadas, 2 jogos finais, 4 participantes, 8 períodos, 16 placares por período, 42 slots/associações/totais, 81 faltas, 2 objetos privados e 2 auditorias, sem parcial ou excedente.
- WP-09 merge: PR #14 integrada por squash no commit `91c59dd`; produção não publicada.
- WP-10 banco: migration integral aprovada em rollback e persistida; 27 pgTAP aprovados, inclusive negações, idempotência, conflito e RLS anônima.
- WP-10 staging: 4 colocações, 4 conquistas de equipe e 4 de atleta em 2025/2026; advisors sem novo item acionável.
- WP-10 gate local: Biome, TypeScript strict, 11 arquivos/40 testes Vitest, builds cliente/SSR Worker e scan de 286 arquivos aprovados.
- WP-10 preview administrativo: sessão real `aal2`; alteração/restauração do rótulo confirmadas pelo RPC, duas auditorias `final_placement_confirmed` registradas e fixture final preservada.
- WP-10 remoto: PR #15 limpa para merge; `gate`, `database`, `upload` e `analyze` aprovados no head `225df5b` antes da evidência documental final.
- WP-10 merge: PR #15 integrada por squash no commit `191069c`; produção não publicada.
- WP-11 SQL representativo: 250 jogos/240 atletas/6.000 slots/24.000 linhas; simples 158,089 ms e avançado 196,174 ms, abaixo da meta de 250 ms.
- WP-11 HTTP no preview, 30 amostras: estatísticas p50 318 ms/p95 711 ms; jogo FIBA p50 374 ms/p95 597 ms, abaixo das metas de 1.000/1.500 ms.
- WP-11 decisão: nenhum cache ou índice novo; medições e advisors não demonstraram necessidade.
- WP-11 CI: a primeira execução tratou o benchmark em `supabase/tests/` como pgTAP sem plano; o arquivo opt-in foi movido para `supabase/benchmarks/`, preservando a suíte automática.
- WP-11 remoto: PR #16 com `gate`, `database`, `upload` e `analyze` aprovados no head `88135ca`; estatísticas e jogo FIBA validados no preview.

## 12. Git

- Repositório: `https://github.com/renato-lucindo/base-do-basquete` (privado).
- Branch documental pós-release: `codex/wp-13-final-handoff`.
- Evidência final integrada em `main`: PR #22 por squash no commit `2e7e530`.
- Checks do head final da PR #22: `gate`, `database`, `upload` e `analyze` aprovados.
- Produção confirmada após o merge com `/health` retornando `environment=production` e `status=ok`.
- Este documento é o follow-up final pós-merge; para o HEAD mais recente, consultar `git log --oneline -10`.

## 13. Bugs, riscos e bloqueios conhecidos

- Não existe acesso ao repositório antigo; isso é decisão de greenfield, não bloqueio.
- Login, MFA ou CAPTCHA podem exigir ação pontual do responsável.
- Qualquer plano pago exige aprovação explícita.
- Uma branch Supabase isolada custaria US$ 0,01344/h; não foi criada. O banco de produção foi validado transacionalmente antes das migrations persistidas e reconciliado antes do release.
- Docker não está instalado neste host; o reset local do Supabase desde zero não pôde ser executado. O fallback remoto foi DDL integral em rollback, aplicação versionada e testes repetidos no esquema persistido.
- O advisor informa que a proteção de senhas vazadas está desativada; o recurso exige plano Pro e não será habilitado sem autorização de upgrade. A política gratuita já exige 12 caracteres, maiúsculas, minúsculas, dígitos e símbolos, além de MFA obrigatório.
- O advisor informa RLS sem policy em `private.admin_accounts`; isso é intencional porque o schema é privado, sem grants ao cliente, e a consulta ocorre somente por função interna restrita.
- GitHub Code Scanning nativo está indisponível para o repositório privado no plano atual; o workflow gera e preserva SARIF como alternativa sem custo.
- A escolha e configuração de domínio devem aguardar instrução futura.
- Não reduzir MFA, RLS, autorização backend ou proteção de segredos para acelerar a primeira temporada.

## 14. O que não deve ser refeito ou antecipado

- Não reconstruir as 156 tarefas antigas individualmente; elas são somente referência de cobertura.
- Não procurar o repositório anterior.
- Não redesenhar o plano antes de iniciar sem evidência de impedimento real.
- Não implementar múltiplos administradores, convites, RBAC ou gestão de usuários.
- Não implementar OCR, parser genérico ou súmula oficial completa.
- Não pesquisar ou configurar domínio.
- Não criar microserviços, cache distribuído ou infraestrutura local persistente sem necessidade comprovada.

## 15. Atualização ao encerrar uma sessão

Antes de encerrar, substitua o estado acima por fatos atuais e registre:

- pacote e tarefa em andamento;
- último item concluído e respectiva evidência;
- próximo passo exato, incluindo arquivo/serviço e validação;
- branch, último commit e resumo do `git status`;
- arquivos alterados e mudanças ainda não concluídas;
- comandos executados e resultados reais;
- bugs, bloqueios e tentativas realizadas;
- decisões técnicas novas e seus motivos;
- alterações nos ambientes GitHub, Cloudflare e Supabase.

Não deixe informação essencial apenas na conversa. Faça commit e push do handoff quando for apropriado e seguro.

## 16. Registro de handoffs

| Data | Sessão/agente | Estado deixado | Próximo passo |
| --- | --- | --- | --- |
| 2026-08-21 | Planejamento inicial | Plano concluído; implementação não iniciada | Executar WP-00 e criar o repositório privado |
| 2026-08-21 | Codex | Pacote lido; baseline WP-00 pronta localmente; GitHub exige login | Autenticar GitHub, criar remoto privado e publicar WP-00 |
| 2026-08-21 | Codex | GitHub privado e Supabase gratuito criados; WP-00 concluído | Integrar fechamento do WP-00 e criar Worker de preview no WP-01 |
| 2026-08-21 | Codex | WP-00 integrado; Supabase saudável; Worker bootstrap passa no gate local | Autenticar Cloudflare e publicar preview do WP-01 |
| 2026-08-21 | Codex | Cloudflare/GitHub configurados; preview publicado e smoke HTTP 200 | Integrar WP-01 por PR e iniciar WP-02 |
| 2026-08-21 | Codex | WP-02 com PR #3, CI, preview, CodeQL/SARIF e smoke aprovados | Integrar PR #3 e iniciar WP-03 |
| 2026-08-21 | Codex | WP-03 técnico aprovado na PR #8; conta real e TOTP ainda não criados | Responsável cria usuário sem compartilhar senha; Codex registra ID e valida MFA |
| 2026-08-21 | Codex | Única conta Auth criada e vinculada atomicamente ao singleton; advisors revisados | Responsável conclui o TOTP no preview; Codex valida `aal2`, auditoria e gate final |
| 2026-08-21 | Codex | TOTP real verificado; sessão `aal2`, auditoria, RLS e gate consolidado aprovados | Aguardar checks do head final, integrar PR #8 e criar branch do WP-04 |
| 2026-08-21 | Codex | PR #8 integrada; WP-04 migrado no Supabase, seed privado, tipos, 34 testes SQL e gate local aprovados | Publicar PR do WP-04 e integrar somente com checks verdes |
| 2026-08-21 | Codex | PR #9 integrada; WP-05 com rotas e fixtures contextuais, 12 testes e gate local aprovados | Commitar WP-05 e validar smoke contextual no preview |
| 2026-08-21 | Codex | PR #10 com CI/database, preview/smoke, CodeQL e navegação real aprovados | Enviar evidências finais, reconfirmar head e integrar sem produção |
| 2026-08-21 | Codex | PR #10 integrada; WP-06 com RPCs, hub, elencos, camisas, 21 asserts SQL e gate local aprovados | Abrir PR e validar fluxo administrativo real no preview |
| 2026-08-21 | Codex | PR #11 com todos os checks verdes; MFA/AAL2, hub, gravação idempotente e auditoria real aprovados | Enviar evidências finais, reconfirmar checks e integrar o WP-06 |
| 2026-08-21 | Codex | PR #11 integrada; WP-07 com transação, editor, 19 pgTAP, 25 testes e gate local aprovados | Commitar, abrir PR e validar um jogo completo no preview autenticado |
| 2026-08-21 | Codex | PR #12 com CI/preview e smoke `aal2` aprovados; jogo manual, placar, atomicidade, auditoria e redirecionamento público validados | Enviar evidências finais, marcar PR pronta e integrar sem produção |
| 2026-08-21 | Codex | PR #12 integrada; WP-08 com views contextuais, fixtures de duas edições, páginas públicas, 14 pgTAP e gate local aprovados | Commitar, abrir PR, validar preview e medir p50/p95 HTTP |
| 2026-08-21 | Codex | PR #13 com todos os gates verdes; smoke 2025/2026, boxscore, 404 e benchmark p50/p95 aprovados | Enviar evidências finais, marcar PR pronta e integrar sem produção |
| 2026-08-24 | Codex | PR #13 integrada; WP-09 implementado na PR #14 com parser dos dois PDFs, 23 pgTAP, 39 Vitest e todos os checks verdes | Fazer login/MFA no host da PR #14, importar os dois PDFs, testar duplicata e integrar sem produção |
| 2026-08-24 | Codex | WP-09 validado em `aal2`: dois jogos finais, duplicata recusada, banco/Storage/auditoria reconciliados | Enviar evidências, reconfirmar o head da PR #14 e integrar sem produção |
| 2026-08-24 | Codex | PR #14 integrada; WP-10 com RPC `aal2`, views históricas, 27 pgTAP, fixtures e gate local aprovados | Abrir PR do WP-10 e validar administração/perfis no preview |
| 2026-08-24 | Codex | PR #15 com todos os gates verdes; smoke `aal2`, auditoria e históricos de equipe/atleta reconciliados | Enviar evidência final, integrar WP-10 e criar a branch do WP-11 |
| 2026-08-24 | Codex | PR #15 integrada; WP-11 mediu SQL/HTTP com volume e metas explícitos, sem justificar cache | Executar gate, abrir PR do WP-11 e validar o preview final |
| 2026-08-24 | Codex | PR #16 com gates verdes; benchmark opt-in separado de pgTAP e preview público aprovado | Enviar evidência final, integrar WP-11 e criar a branch do WP-12 |
| 2026-08-24 | Codex | PR #16 integrada; WP-12 instrumentado e gate local/ensaios de recuperação em staging aprovados | Commitar WP-12, abrir PR #17 e validar logs redigidos no Worker de preview |
| 2026-08-24 | Codex | PR #17 com quatro checks verdes; head promovido em staging e eventos redigidos confirmados ao vivo | Enviar evidências finais, reconfirmar gates e integrar WP-12 sem produção |
| 2026-08-24 | Codex | PR #17 integrada; WP-13 com advisors/reconciliação, secrets isolados e workflow de release seguro preparado | Abrir PR #18, integrar com gates verdes e publicar pela `main` |
| 2026-08-24 | Codex | PR #18 integrada e tag `v1.0.0` criada; primeiro dispatch recusado por YAML antes de qualquer deploy | Integrar correção em bloco literal e repetir o dispatch pela `main` |
| 2026-08-24 | Codex | `v1.0.3` publicada; gate automatizado, logs, métricas e rollout 10% → 100% aprovados, com rollback preservado | Responsável conclui login/TOTP no host estável; Codex valida `aal2` e integra a evidência final |
| 2026-08-24 | Codex | Smoke de produção confirmou `aal2`, hub, logout e auditoria; senha autofill apareceu na inspeção e foi declarada comprometida | Responsável rotaciona a senha no Supabase sem compartilhá-la; novo login/MFA libera o gate final da PR #22 |
| 2026-08-24 | Responsável/Codex | Responsável recusou conscientemente a rotação e aceitou o risco residual; WP-13 marcado `DONE` sem reduzir os controles de segurança | Executar gate final, integrar PR #22 por squash e confirmar produção saudável |
| 2026-08-24 | Codex | PR #22 integrada por squash em `2e7e530` após quatro checks verdes; produção respondeu `production/ok` | Plano atual encerrado; próxima mudança começa em nova branch WP após conferir `main` e `/health` |
