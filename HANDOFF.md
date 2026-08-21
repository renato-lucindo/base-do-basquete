# HANDOFF — Base do Basquete

> Estado persistente para continuidade entre sessões, contas e agentes Codex. Atualize fatos e evidências; não registre segredos.

## 1. Objetivo

Construir do zero e publicar a **Base do Basquete**, aplicação web de dados e histórico do basquete, com administração de campeonatos, equipes, jogadores, elencos, jogos, estatísticas, colocações, conquistas, súmula manual e importação de um único formato de boxscore PDF.

## 2. Estado atual

- Fase: WP-00 a WP-06 concluídos e integrados; WP-07 em execução.
- Status geral: `IN PROGRESS` no WP-07; transação de súmula, editor, 19 pgTAP e gate local aprovados.
- Repositório GitHub: privado em `renato-lucindo/base-do-basquete`.
- Branch atual: `wp-07-manual-scoresheet`.
- Último commit integrado em `main`: `07454a1` (`WP-06 — hub administrativo, equipes e elencos (#11)`).
- Aplicação publicada: previews temporários por PR estão saudáveis; produção ainda não publicada.
- Cloudflare: autenticado; token mínimo de CI criado, secrets cadastrados no GitHub e Worker de preview saudável.
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
- [ ] Aplicação implementada integralmente; WP-00 a WP-06 concluídos e WP-07 em execução.
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

## 5. Em andamento

WP-07 está na branch própria. A RPC `admin_create_manual_scoresheet` cria e encerra jogo, participantes, 12 slots, períodos, estatísticas, faltas, GD, placar e auditoria em uma transação idempotente. O editor `aal2` oferece prefill/fallback, N/A, camisas textuais, Q1–Q4/OT e bloqueios redundantes no BFF/banco. Os 19 pgTAP passaram antes e depois da migration persistida; 25 testes e o gate local completo passaram.

## 6. Próximo passo exato

1. Fazer scan staged, commit/push e abrir a PR do WP-07.
2. Validar CI/database desde zero, preview e CodeQL.
3. No novo preview, autenticar em `aal2`, criar e encerrar um jogo completo; confirmar placar, auditoria e atomicidade antes do merge.

### Primeiros arquivos a abrir

- `AGENTS.md`
- `HANDOFF.md`
- `docs/plan/README.md`
- `docs/plan/PROMPT-MESTRE-IDE.md`
- `docs/plan/PLANO-EXECUCAO.md`

### Resultado esperado do próximo passo

Preview navegando entre anos/categorias sem mistura de dados, incluindo 404 contextual e precedência de `/admin`.

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
| WP-07 — Jogos e súmula manual | `IN PROGRESS` | Transação, editor, staging, 19 pgTAP e gate local aprovados |
| WP-08 a WP-13 | `BACKLOG` | Seguir dependências do plano |

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

Serviços configurados: repositório privado e environments no GitHub, Worker de preview no Cloudflare e projeto gratuito saudável no Supabase. Produção permanece intencionalmente não publicada.

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
- WP-07 gate local: Biome em 50 arquivos, TypeScript strict, 8 arquivos/25 testes Vitest, builds cliente/SSR e scan de 263 arquivos aprovados.
- WP-07 advisors: FK `games.created_by` indexada; nenhum item acionável de segurança/performance permanece além dos avisos já documentados e índices novos sem uso.

## 12. Git

- Repositório: `https://github.com/renato-lucindo/base-do-basquete` (privado).
- Branch: `wp-07-manual-scoresheet`.
- Base integrada em `main`: `07454a1`.
- Alterações WP-07 ainda não commitadas; duas migrations já aplicadas no Supabase pré-produção após rollback e testes aprovados.

Substitua esta seção por dados reais assim que o repositório for criado.

## 13. Bugs, riscos e bloqueios conhecidos

- Não existe acesso ao repositório antigo; isso é decisão de greenfield, não bloqueio.
- Login, MFA ou CAPTCHA podem exigir ação pontual do responsável.
- Qualquer plano pago exige aprovação explícita.
- Uma branch Supabase isolada custaria US$ 0,01344/h; não foi criada. O projeto atual ainda é pré-produção e foi validado transacionalmente antes das migrations persistidas.
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
