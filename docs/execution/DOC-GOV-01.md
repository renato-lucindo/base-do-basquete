# DOC-GOV-01 — Fundação da governança documental

## Estado

Implementação inicial preparada em branch isolada, aguardando revisão de governança antes de merge.

## Base

- Base Git: `origin/main` em `fe642353992f50079233d5c39c6adb8ec6da142b`.
- Branch: `codex/doc-gov-01`.
- Banco, Cloudflare e produção: não alterados.
- Workspace original e arquivos não rastreados: preservados.

## Escopo entregue

- plano de governança documental em estado de proposta;
- catálogo inicial de fontes e conflitos de autoridade;
- inventário Markdown reproduzível e somente leitura;
- template de PR alinhado ao `REVIEW_PACKET` dos agentes;
- exclusão de `tmp/` do Git e do alcance do Biome;
- exclusão de protótipos documentais do gate global do Biome;
- entrada explícita da proposta no índice do plano.

## Escopo negativo preservado

- nenhum documento existente foi movido, renomeado ou apagado;
- nenhuma duplicata do workspace original foi modificada;
- requisitos, arquitetura e decisões de produto não foram alterados;
- nenhum código funcional, migration, serviço remoto ou dado foi modificado;
- `HANDOFF.md` não foi reescrito enquanto existe trabalho funcional concorrente fora desta worktree.

## Validação

- `node scripts/document-inventory.mjs`: aprovado;
- `npm run docs:inventory --silent`: aprovado;
- Biome focal em `biome.json`, `package.json` e `scripts/document-inventory.mjs`: aprovado;
- `node scripts/scan-secrets.mjs`: aprovado em 607 arquivos rastreados;
- `git diff --check origin/main...HEAD`: aprovado após normalização do EOF;
- Biome global: executado e bloqueado por 19 erros e 146 avisos preexistentes fora do escopo, principalmente ordenação de imports e especificidade do CSS; nenhum arquivo apontado pertence ao delta desta unidade.

## Revisão necessária

`qa-reviewer` é obrigatório porque a unidade altera governança, template de PR e alcance do lint. Não há impacto de banco ou segurança de dados que exija `database-security-reviewer`.

## Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: qa-reviewer
ARQUIVO_OU_SERVICO: diff da branch codex/doc-gov-01 contra origin/main
ACAO: validar precedência, catálogo, template de PR, exclusões do Biome e reprodutibilidade do inventário
CRITERIO_DE_CONCLUSAO: parecer vinculado ao HEAD da branch, sem conflito de autoridade novo e sem redução indevida dos gates funcionais
```
