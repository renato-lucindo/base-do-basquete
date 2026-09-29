# Como contribuir

Este repositório usa unidades de trabalho pequenas, branches curtas e revisão proporcional ao risco. As regras permanentes estão em `AGENTS.md`; este guia resume o caminho operacional para colaboradores humanos e agentes.

## Antes de começar

1. Leia `AGENTS.md`, `HANDOFF.md` e `docs/plan/README.md`.
2. Consulte os documentos ativos indicados pelo índice.
3. Execute `git status` e `git log --oneline -10`.
4. Preserve qualquer mudança preexistente e identifique sua origem.
5. Defina objetivo, critérios de aceite, escopo e escopo negativo.
6. Use branch curta `codex/<unidade>` ou o prefixo aprovado para o pacote.
7. Use worktree separada quando outro fluxo já estiver ativo no checkout.

## Ambiente

- Node.js 24 ou superior;
- npm e `package-lock.json` como fonte das dependências;
- Docker apenas para testes locais completos do Supabase; a CI mantém banco descartável;
- secrets somente nos cofres autorizados, nunca em arquivos ou logs.

Instalação e verificações principais:

```powershell
npm ci
npm run typecheck
npm test
npm run check
```

Durante a implementação, execute testes focais. Rode o gate consolidado uma vez quando a unidade estiver estável, antes do push.

## Unidade de trabalho

Toda contribuição deve declarar:

- identificador da unidade;
- objetivo;
- critérios de aceite;
- escopo e escopo negativo;
- arquivos, migrations e serviços afetados;
- riscos conhecidos;
- testes e evidências;
- revisores obrigatórios.

Não amplie o escopo silenciosamente. Necessidade material nova exige atualizar a unidade ou abrir outra.

## Documentação

- pesquise antes de criar documento novo;
- atualize a fonte autoritativa em vez de criar cópia;
- registre estado, owner, escopo e substituição quando aplicável;
- mantenha planos em `docs/plan/` e resultados reais em `docs/execution/`;
- não use o `HANDOFF.md` como arquivo histórico permanente;
- não mova ou apague duplicata antes de reconciliar referências e origem;
- execute `npm run docs:inventory` quando alterar governança ou estrutura documental.

## Segurança e dados

- nunca registre secrets, tokens, cookies, senhas, códigos MFA ou connection strings;
- não inclua dados privados em issues, PRs, logs ou fixtures;
- mantenha autorização e validações críticas no backend e no banco;
- migrations aplicadas são imutáveis; correções usam nova migration aditiva;
- consulte `SECURITY.md` para reporte privado de vulnerabilidades.

## Pull request

1. Revise `git diff` e `git status`.
2. Execute testes proporcionais e varredura de segredos.
3. Faça commits pequenos e coerentes.
4. Abra PR inicialmente como draft quando ainda faltar evidência ou revisão.
5. Preencha o template e o `REVIEW_PACKET` integralmente.
6. Aguarde os checks obrigatórios.
7. Obtenha os pareceres correspondentes ao mesmo `HEAD_COMMIT`.
8. Não faça merge de WIP nem publique produção por branch de trabalho.

Mudanças funcionais, de dependências, workflows, segurança, banco ou governança exigem `qa-reviewer`. Banco, Auth, RLS, grants, dados privados e escritas críticas também exigem `database-security-reviewer`.

## Conclusão

A contribuição termina quando código, documentação e ambientes estão coerentes, os gates aplicáveis passaram, as evidências foram registradas e existe um próximo passo exato ou encerramento explícito. Branches e worktrees só são removidas depois da integração confirmada.
