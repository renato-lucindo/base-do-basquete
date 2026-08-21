# HANDOFF — Base do Basquete

> Estado persistente para continuidade entre sessões, contas e agentes Codex. Atualize fatos e evidências; não registre segredos.

## 1. Objetivo

Construir do zero e publicar a **Base do Basquete**, aplicação web de dados e histórico do basquete, com administração de campeonatos, equipes, jogadores, elencos, jogos, estatísticas, colocações, conquistas, súmula manual e importação de um único formato de boxscore PDF.

## 2. Estado atual

- Fase: WP-00 a WP-02 concluídos; WP-03 implementado e aguardando provisionamento humano da conta real/MFA.
- Status geral: `WIP — HUMAN ACTION` na PR #8; não integrar enquanto a conta real em `aal2` não passar no gate.
- Repositório GitHub: privado em `renato-lucindo/base-do-basquete`.
- Branch atual: `wp-03-single-admin-auth`.
- Último commit integrado em `main`: `9bcbe99` (`WP-02 — Scaffold, CI/CD e previews por PR (#3)`).
- Aplicação publicada: preview administrativo da PR #8 disponível em URL temporária `workers.dev`; produção ainda não publicada.
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
- [ ] Aplicação implementada.
- [x] Serviços cloud básicos configurados.
- [x] Scaffold React Router full-stack em Cloudflare Workers.
- [x] CI, preview por PR, Dependabot e CodeQL com SARIF configurados.
- [x] Fluxo server-side de login, matrícula/desafio TOTP e logout implementado.
- [x] Migration de administrador singleton, RLS `aal2` e auditoria aplicada/validada.
- [ ] Conta administrativa real criada, registrada e com MFA matriculado.

## 5. Em andamento

WP-03 passou nos gates técnicos local/remoto e nos testes diretos de RLS. A PR #8 permanece WIP porque criar a senha inicial e matricular o TOTP exigem ação humana privada.

## 6. Próximo passo exato

1. Responsável cria diretamente o único usuário em Supabase Authentication > Users, sem convite, e não compartilha a senha.
2. Codex consulta o novo `user_id` e o registra em `private.admin_accounts`.
3. Responsável entra no preview da PR #8 e conclui a matrícula TOTP.
4. Codex valida auditoria, `aal2`, RLS e gate final; depois documenta e integra a PR #8.

### Primeiros arquivos a abrir

- `AGENTS.md`
- `HANDOFF.md`
- `docs/plan/README.md`
- `docs/plan/PROMPT-MESTRE-IDE.md`
- `docs/plan/PLANO-EXECUCAO.md`

### Resultado esperado do próximo passo

Conta real registrada, sessão administrativa em `aal2` comprovada, PR #8 integrada e branch do WP-04 criada.

## 7. Pacotes de trabalho

| Pacote | Estado | Observação |
| --- | --- | --- |
| WP-00 — Repositório e decisões iniciais | `DONE` | Baseline em `main`; proteção obrigatória indisponível no plano gratuito do repositório privado |
| WP-01 — Ambientes cloud | `DONE` | PR #2 integrada; preview bootstrap saudável |
| WP-02 — Scaffold, CI e preview | `DONE` | PR #3 integrada; preview por PR validado |
| WP-03 — Administrador único | `WIP` | Código/gates aprovados; falta conta real e matrícula TOTP humana |
| WP-04 a WP-13 | `BACKLOG` | Seguir dependências do plano |

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
- Dependências: `npm install` auditou 175 pacotes e não encontrou vulnerabilidades.
- GitHub Actions: CI #10, preview #9 e CodeQL #10 aprovados na PR #8.
- CodeQL: SARIF de 70.839 bytes preservado por 14 dias; upload ao Code Scanning indisponível no plano atual do repositório privado.
- Falhas conhecidas: nenhuma funcional; conclusão do WP-03 depende somente de senha e TOTP mantidos pelo responsável.
- Evidências de pacotes: registrar em `docs/execution/WP-XX.md`.

## 12. Git

- Repositório: `https://github.com/renato-lucindo/base-do-basquete` (privado).
- Branch: `wp-03-single-admin-auth`.
- Último commit funcional validado: `f099426` (`feat(auth): enforce single-admin MFA sessions`).
- `git status`: atualização WIP de evidências aguarda commit.

Substitua esta seção por dados reais assim que o repositório for criado.

## 13. Bugs, riscos e bloqueios conhecidos

- Não existe acesso ao repositório antigo; isso é decisão de greenfield, não bloqueio.
- Login, MFA ou CAPTCHA podem exigir ação pontual do responsável.
- Qualquer plano pago exige aprovação explícita.
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
