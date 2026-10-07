# DOC-GOV-02 — Handoff operacional

## Estado

Implementação documental concluída localmente na branch `codex/doc-gov-02`. A unidade reduz o `HANDOFF.md` ao estado necessário para retomada e preserva o histórico por referências versionadas, sem alterar código ou serviços. O gate de merge/release permanece em `BLOCK_RELEASE` exclusivamente porque `qa-reviewer` é obrigatório e não foi acionado nesta retomada, em respeito à instrução explícita de não usar subagents.

## Base

- Base Git: `origin/main` em `b663b7acf1be3ce5463468a17613ae983bbe5a26`.
- A base corresponde ao merge da PR #64 em 02/10/2026.
- `DOC-GOV-01` já está integrada em `main` pelo merge `4a5e628` da PR #56.
- Banco, Cloudflare e produção: não alterados.
- Checkout funcional original e arquivos não rastreados: preservados em outro worktree.

## Problema reconciliado

O `HANDOFF.md` da base possuía 603 linhas e acumulava simultaneamente:

- estado corrente;
- decisões e pacotes já concluídos;
- comandos e evidências históricas;
- riscos antigos;
- uma tabela cronológica extensa de handoffs.

Além do volume, o topo ainda dizia que a integração da PR #64 aguardava autorização, apesar de `origin/main` já estar no merge `b663b7a`. Isso criava dois riscos: retomada por um próximo passo superado e uso do handoff como arquivo histórico permanente.

## Escopo entregue

- novo `HANDOFF.md` orientado apenas à retomada corrente;
- `WRITE_LOCK`, base, branch, escopo negativo, bloqueios e próximo passo em formato inequívoco;
- separação explícita entre checkpoint operacional e histórico;
- preservação do handoff anterior pelo histórico Git (`b663b7a:HANDOFF.md`);
- encaminhamento de execuções fechadas para `docs/execution/`, decisões para `docs/decisions/` e operação para `docs/runbooks/`;
- reconciliação do índice para indicar que a governança documental está em implantação após `DOC-GOV-01`;
- atualização do catálogo sem mover ou apagar documentos.

## Preservação do histórico

Nenhum conteúdo histórico depende do novo handoff para sobreviver:

1. o arquivo integral anterior continua versionado no commit-base `b663b7a` e em seus ancestrais;
2. fechamentos de WPs, MVPs, POSTs e demais unidades permanecem em `docs/execution/`;
3. ADRs aceitos permanecem em `docs/decisions/`;
4. runbooks permanecem em `docs/runbooks/`;
5. PRs e workflows continuam como evidência remota no GitHub.

A redução não reescreve nem apaga essas fontes. `DOC-GOV-03` continuará responsável por eventual deduplicação e atualização de links, em unidade separada.

## Escopo negativo preservado

- nenhuma feature ou comportamento da aplicação alterado;
- nenhuma migration, policy, dado ou schema alterado;
- nenhum deploy, preview ou produção modificado;
- nenhum documento histórico movido, renomeado ou excluído;
- nenhuma deduplicação ampla executada;
- nenhum front matter aplicado em massa;
- nenhum novo gate de CI ativado;
- nenhum merge ou release autorizado por esta unidade.

## Critérios de aceite

- `HANDOFF.md` com menos de 200 linhas;
- somente fatos necessários para retomada presentes no handoff;
- um único `PROXIMO_PASSO_EXATO` operacional;
- história removida acessível via Git ou evidência versionada;
- `WRITE_LOCK` e revisores obrigatórios explícitos;
- nenhuma alteração fora do escopo documental;
- `qa-reviewer` obrigatório antes de merge.

## Validação

Validações executadas em 06/10/2026 no worktree isolado:

- `npm run docs:inventory`: aprovado; 352 Markdown encontrados, 351 rastreados e 1 não rastreado correspondente a este novo registro antes do commit; nenhuma duplicata exata detectada. Colisões de basename já conhecidas permanecem para `DOC-GOV-03`.
- primeira tentativa de `npm run check`: interrompida antes de validar o projeto porque o worktree isolado não possuía `node_modules` nem `node_modules/.bin/biome.cmd`; não houve falha funcional do repositório nessa tentativa.
- ambiente local restaurado com `npm ci`, sem alteração de `package.json` ou `package-lock.json`.
- `npm run check`: aprovado após a restauração do ambiente. `format:check`, `lint`, `typecheck`, 55 arquivos de teste/406 testes, `check:runbooks`, `check:agents`, build e `scan:secrets` concluíram com sucesso. O lint reportou 292 warnings já existentes e nenhum erro bloqueante.
- `scan:secrets`: aprovado dentro de `npm run check` para 682 arquivos rastreados.
- `git diff --check`: aprovado.
- `HANDOFF.md`: 108 linhas, abaixo do alvo de 200.
- `git status`: somente os cinco arquivos documentais desta unidade permaneciam alterados/não rastreados antes do commit.

O `npm ci` também reportou seis vulnerabilidades de severidade alta no inventário de dependências existente. Nenhuma dependência foi alterada nesta unidade documental; eventual remediação deve ocorrer em unidade própria para não misturar escopo.

## Revisão necessária

`qa-reviewer` é obrigatório para qualquer integração porque a unidade altera governança e o processo de retomada. Como esta retomada foi executada sem subagents, nenhum parecer foi fabricado ou atribuído. A implementação local está encerrada; somente o gate de integração permanece bloqueado. `database-security-reviewer` e `accessibility-ui-reviewer` não são exigidos: não há mudança de banco, segurança de dados ou interface.

## Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: responsável do projeto
ARQUIVO_OU_SERVICO: codex/doc-gov-02
ACAO: somente se decidir integrar a unidade, viabilizar qa-reviewer independente para o HEAD exato e autorizar separadamente qualquer operação remota
CRITERIO_DE_CONCLUSAO: parecer QA válido antes de integração; na ausência dele, manter BLOCK_RELEASE sem novas mutações
```
