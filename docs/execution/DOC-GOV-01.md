# DOC-GOV-01 — Fundação da governança documental

## Estado

Implementação inicial preparada em branch isolada. O primeiro parecer independente solicitou correções de consistência documental; os achados foram tratados antes da nova revisão.

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
- perfil proporcional para ISO/IEC/IEEE 15289:2019, 12207:2026 e 26514:2022 e práticas GitHub;
- guia `CONTRIBUTING.md` e ownership humano das áreas sensíveis;
- exclusão de `tmp/` do Git e do alcance do Biome;
- exclusão de protótipos documentais do gate global do Biome;
- entrada explícita da proposta no índice do plano.

## Escopo negativo preservado

- nenhum documento existente foi movido, renomeado ou apagado;
- nenhuma duplicata do workspace original foi modificada;
- requisitos, arquitetura e decisões de produto não foram alterados;
- nenhum código funcional, migration, serviço remoto ou dado foi modificado;
- `HANDOFF.md` foi reconciliado sem incorporar ou alterar o conteúdo funcional da PR paralela #57.

## Validação

- `node scripts/document-inventory.mjs`: aprovado;
- `npm run docs:inventory --silent`: aprovado;
- Biome focal em `biome.json`, `package.json` e `scripts/document-inventory.mjs`: aprovado;
- `node scripts/scan-secrets.mjs`: aprovado em 611 arquivos rastreados após a ampliação do perfil;
- `git diff --check origin/main...HEAD`: aprovado após normalização do EOF;
- CI `gate` e `database`, preview/smokes e CodeQL: aprovados no HEAD `c6dcaf2` antes das correções solicitadas; devem ser renovados no novo HEAD.
- primeiro parecer `qa-reviewer`: `REQUEST_CHANGES` em `c6dcaf2`; handoff divergente, baseline local não reproduzível e próximo passo superado foram corrigidos nesta revisão.
- gate local consolidado após as correções: aprovado; formatação em 164 arquivos, lint em 165 arquivos sem erros e com 146 avisos preexistentes, TypeScript estrito, 45 arquivos/324 Vitest, cinco runbooks, build cliente/SSR e scan de 611 arquivos.

## Revisão necessária

`qa-reviewer` é obrigatório porque a unidade altera governança, template de PR, ownership e alcance do lint. Não há impacto de banco ou segurança de dados que exija `database-security-reviewer`.

## Próximo passo exato

```text
PROXIMO_PASSO_EXATO:
RESPONSAVEL: qa-reviewer
ARQUIVO_OU_SERVICO: diff da branch codex/doc-gov-01 contra origin/main
ACAO: validar precedência, perfil das referências, catálogo, template de PR, CODEOWNERS, exclusões do Biome e reprodutibilidade do inventário
CRITERIO_DE_CONCLUSAO: parecer vinculado ao HEAD da branch, sem alegação normativa indevida, conflito de autoridade novo ou redução dos gates funcionais
```
