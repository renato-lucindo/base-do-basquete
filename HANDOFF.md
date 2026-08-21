# HANDOFF — Base do Basquete

> Estado persistente para continuidade entre sessões, contas e agentes Codex. Atualize fatos e evidências; não registre segredos.

## 1. Objetivo

Construir do zero e publicar a **Base do Basquete**, aplicação web de dados e histórico do basquete, com administração de campeonatos, equipes, jogadores, elencos, jogos, estatísticas, colocações, conquistas, súmula manual e importação de um único formato de boxscore PDF.

## 2. Estado atual

- Fase: WP-00 concluído; WP-01 em andamento.
- Status geral: `BLOCKED` em WP-01 somente pelo login humano no Cloudflare.
- Repositório GitHub: privado em `renato-lucindo/base-do-basquete`; `main` e `wp-00-repository-foundation` publicadas.
- Branch atual: `wp-01-cloud-environments`.
- Último commit integrado em `main`: `78c95a2` (`WP-00 — Repositório e decisões iniciais (#1)`).
- Aplicação publicada: não.
- Cloudflare: configuração declarativa e Worker bootstrap prontos; navegador está na tela de login e exige ação humana.
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
- [ ] Serviços cloud configurados.

## 5. Em andamento

WP-01 está validado localmente e aguarda apenas autenticação no Cloudflare para criar/publicar o Worker de preview e cadastrar secrets nos cofres corretos.

## 6. Próximo passo exato

1. O responsável deve entrar no Cloudflare na aba já aberta e informar que o painel está acessível.
2. Criar/publicar o Worker `base-do-basquete-preview` sem domínio próprio e executar smoke em `GET /health`.
3. Cadastrar `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` nos environments GitHub sem revelar valores.
4. Concluir o gate remoto do WP-01, integrar por squash e criar `wp-02-scaffold-ci-preview`.

### Primeiros arquivos a abrir

- `AGENTS.md`
- `HANDOFF.md`
- `docs/plan/README.md`
- `docs/plan/PROMPT-MESTRE-IDE.md`
- `docs/plan/PLANO-EXECUCAO.md`

### Resultado esperado do próximo passo

Repositório privado acessível, documentação inicial versionada, nenhum segredo no histórico, decisões iniciais registradas e WP-00 concluído com evidência.

## 7. Pacotes de trabalho

| Pacote | Estado | Observação |
| --- | --- | --- |
| WP-00 — Repositório e decisões iniciais | `DONE` | Baseline em `main`; proteção obrigatória indisponível no plano gratuito do repositório privado |
| WP-01 — Ambientes cloud | `BLOCKED` | Build local e Supabase prontos; aguarda login Cloudflare |
| WP-02 — Scaffold, CI e preview | `BACKLOG` | Depende de WP-00/WP-01 |
| WP-03 — Administrador único | `BACKLOG` | Auth, MFA, `aal2`, backend e RLS |
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

Serviços previstos: GitHub, Cloudflare Workers e Supabase PostgreSQL/Auth/Storage. Nenhum deles está configurado neste estado inicial.

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
- `npm run typecheck` — TypeScript strict.
- `npm run build` — build seco do Worker no ambiente preview.
- `npm run check` — gate bootstrap (typecheck + build).
- `npm run deploy:preview` — deploy do Worker de preview.
- `npm run deploy:production` — deploy de produção; permitido somente a partir de `main`.

## 11. Testes e evidências

- Testes executados: `npm run check` aprovado com Wrangler 4.125.0, TypeScript 7.0.2 e build seco do Worker.
- Dependências: `npm install` auditou 38 pacotes e não encontrou vulnerabilidades.
- Falhas conhecidas: deploy remoto bloqueado somente pelo login Cloudflare.
- Evidências de pacotes: registrar em `docs/execution/WP-XX.md`.

## 12. Git

- Repositório: `https://github.com/renato-lucindo/base-do-basquete` (privado).
- Branch: `wp-01-cloud-environments`.
- `git status`: arquivos do Worker bootstrap e deste handoff aguardam commit WIP antes do bloqueio humano.
- Alterações não commitadas: package/lockfile, Worker, Wrangler, workflow bootstrap, environment example e evidência WP-01.

Substitua esta seção por dados reais assim que o repositório for criado.

## 13. Bugs, riscos e bloqueios conhecidos

- Não existe acesso ao repositório antigo; isso é decisão de greenfield, não bloqueio.
- Login, MFA ou CAPTCHA podem exigir ação pontual do responsável.
- Qualquer plano pago exige aprovação explícita.
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
