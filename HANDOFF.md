# HANDOFF — Base do Basquete

> Estado persistente para continuidade entre sessões, contas e agentes Codex. Atualize fatos e evidências; não registre segredos.

## 1. Objetivo

Construir do zero e publicar a **Base do Basquete**, aplicação web de dados e histórico do basquete, com administração de campeonatos, equipes, jogadores, elencos, jogos, estatísticas, colocações, conquistas, súmula manual e importação de um único formato de boxscore PDF.

## 2. Estado atual

- Fase: WP-00 iniciado; baseline local concluída.
- Status geral: `BLOCKED` somente pela autenticação humana no GitHub para criar o repositório remoto.
- Repositório GitHub: criação remota pendente; navegador Codex redireciona para login e a credencial local do `gh` expirou.
- Branch atual: `wp-00-repository-foundation`.
- Último commit funcional: `95cddd1` (`chore(wp-00): establish repository baseline`).
- Aplicação publicada: não.
- Cloudflare: ainda precisa ser configurado.
- Supabase: conector autenticado; existe somente a organização `renato-lucindo` e nenhum projeto. A criação exige confirmação explícita da organização conforme a política da integração.
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
- [ ] Repositório remoto criado.
- [x] Repositório Git local inicializado em branch própria do WP-00.
- [x] Plano importado e ordem de leitura obrigatória concluída.
- [x] ADRs iniciais, política de segurança, `.gitignore` e baseline de varredura de segredos criados.
- [ ] Aplicação implementada.
- [ ] Serviços cloud configurados.

## 5. Em andamento

WP-00 está pronto localmente. Falta autenticar o GitHub, criar o repositório privado, publicar a baseline e configurar a proteção de `main`.

## 6. Próximo passo exato

1. O responsável deve autenticar o GitHub no navegador Codex já aberto e informar que concluiu o login.
2. Criar o repositório privado `base-do-basquete`, configurar o remoto e publicar a baseline sem credenciais.
3. Configurar proteção de `main` compatível com automação e preservar branches WP para previews.
4. Confirmar o uso da única organização Supabase disponível, `renato-lucindo`, para então criar o projeto do WP-01 no plano gratuito.
5. Concluir o gate do WP-00, atualizar a evidência e avançar para WP-01.

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
| WP-00 — Repositório e decisões iniciais | `BLOCKED` | Baseline local pronta; aguarda login GitHub |
| WP-01 — Ambientes cloud | `BACKLOG` | Depende de WP-00 |
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
# Preencher apenas com nomes efetivamente adotados pelo projeto.
```

## 10. Comandos do projeto

Ainda não definidos porque o scaffold não foi criado. Após WP-02, registrar comandos reais para instalação reproduzível, lint, typecheck, testes, build e deploy. Não deixar comandos de exemplo que não tenham sido verificados.

## 11. Testes e evidências

- Testes executados: nenhum; implementação não iniciada.
- Falhas conhecidas: nenhuma falha de código ainda aplicável.
- Evidências de pacotes: registrar em `docs/execution/WP-XX.md`.

## 12. Git

- Repositório: Git local inicializado; remoto ainda não criado.
- Branch: `wp-00-repository-foundation`.
- `git status`: limpo após o commit de handoff desta sessão.
- Alterações não commitadas: nenhuma esperada.

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
