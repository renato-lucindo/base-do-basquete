# PR #72 — QA local equivalente ao job Stage4

Data: 12/10/2026 (America/Araguaina, UTC−03). HEAD executado: `5e4badff991499ae1824e58654c1e46d9c90b2ca`. Artefato funcional preservado: `80a33355d98dc351214d825557323fa29ebf957b`.

## Autorização e escopo

O responsável instruiu “quero realizar manualmente então” após explicar os comandos do job QA Stage4 e a possibilidade de executá-los fora do GitHub Actions. Esta execução local substitui o local de execução desse job específico nesta unidade, mantendo comandos e cobertura. Não altera os workflows, não marca o check remoto como SUCCESS e não autoriza merge, migrations compartilhadas ou produção.

## Execução

Ambiente: Windows/PowerShell, Node v24.18.0, npm11.16.0, Chromium/Playwright1.63.0, servidor local127.0.0.1:5173. Instalação por lockfile (`npm ci`) EXIT0; Chromium instalado/verificado por `npx --no-install playwright install chromium` EXIT0.

| Verificação | Resultado |
| --- | --- |
| `npm run check` | EXIT0; formato/lint/typecheck/67 arquivos e564 testes Vitest/runbooks/agentes/build/scan763 |
| `npm run test:e2e` | EXIT0;36 cenários,35 PASS e1 SKIPPED esperado,5 workers,1,7min |
| Integração read-only | `git fetch --no-tags origin main` e `git merge-tree --write-tree origin/main HEAD` PASS |
| Identidade da integração | main27d917a1ce4a404ced091fd3ca660113c215ca92; tree1ab951c886f5173ca12df62e5444b5c4fbf442bc |
| Audit produção | `npm audit --omit=dev --json`: EXIT0, zero vulnerabilidades |
| Estado Git | Inicialmente limpo; execução alterou somente HANDOFF pelo mantenedor; código, lockfile e workflows preservados |

O único cenário SKIPPED é “public statistics have no serious axe violations and reflow at200 percent”, condicionado a PLAYWRIGHT_PUBLIC_STATS=true e dados publicados no preview. A execução remota correspondente já passou em [Preview38292700402](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700402), no mesmo artefato funcional. Nenhum teste foi removido ou desabilitado.

Evidências anteriores reutilizadas por domínio: [CI38292700529](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700529) (banco, pgTAP/concorrência e upgrade histórico) e [CodeQL38292700390](https://github.com/renato-lucindo/base-do-basquete/actions/runs/38292700390), além dos três pareceres especializados registrados em [relatório anterior](manual-scoresheet-stage9-final-review.md). Não houve novo delta funcional; não reaplicar SQL.

## Logs e integridade

- [Gate completo](evidence/manual-scoresheet-stage9-local-qa/npm-check.log).
- [Suíte E2E completa](evidence/manual-scoresheet-stage9-local-qa/playwright.log).
- [Audit de produção](evidence/manual-scoresheet-stage9-local-qa/npm-audit-production.json).

Logs publicados removem sequências ANSI, normalizam newline/espaços ao fim de linha e substituem o caminho absoluto local por LOCAL_WORKSPACE. Hashes SHA256 dos logs originais: check `b4906ae4215cc3ff4ec2f30465616854cf9eaa04e55ccc23faaf317270dba0f3`; E2E `3d12a39f4a31b3dbba5a159ad20fcc34dd6e1b0600b0dc93cee59318e90a650b`.

## Riscos residuais

O audit integral reportou seis pacotes com severidade alta na cadeia de desenvolvimento: @cloudflare/vite-plugin, miniflare, sharp, source-map-js, undici e wrangler. Audit de produção está limpo. O QA classifica o acompanhamento separado como nota não bloqueante desta unidade; ferramentas de desenvolvimento também representam risco. Não houve alteração de dependências para misturar manutenção de tooling com este gate. A próxima unidade de tooling deve avaliar correções disponíveis, atualizar versões/lockfile e executar gates/revisões próprios antes de encerrar o acompanhamento.

Os320 avisos de lint não impediram o gate; não foram ocultados. Fixtures de navegador não substituem homologação autenticada no banco compartilhado. O check Stage4 remoto continua FAILURE por cobrança; sua integração foi SKIPPED. O resultado local e o parecer abaixo documentam a execução equivalente autorizada para concluir esta etapa, sem falsificar o estado do GitHub.

## Parecer independente renovado

Agente QA Archimedes: `01a1316e-e9d2-7681-8088-18a92e500f46`.

**PARECER: APPROVE_WITH_NON_BLOCKING_NOTES**

```text
WORK_UNIT: MANUAL-SCORESHEET-V2-STAGE9-REVISION
BASE_COMMIT: 98212482e4c316ba0517df70fa9e2d9696f79641
COMMIT_REVISADO: 5e4badff991499ae1824e58654c1e46d9c90b2ca
ARTEFATO_FUNCIONAL: 80a33355d98dc351214d825557323fa29ebf957b
REVIEWED_AT: 2026-10-12T19:21:06Z
```

**Revogo o BLOCK_RELEASE exclusivamente operacional.** A execução local foi explicitamente autorizada pelo responsável e mantém a cobertura exigida. Confirmei nos logs:

- `npm run check`: **67 arquivos/564 testes PASS**, build e scan de 763 arquivos concluídos.
- E2E integral: **35 PASS, 1 SKIPPED esperado**, reservado ao preview e já coberto pela evidência remota verde.
- Audit de produção: **zero vulnerabilidades**.
- Delta desde `80a3335`: exclusivamente documental; código, dependências, testes e workflows preservados.

Aceito a evidência informada de integração `merge-tree PASS` contra `main@27d917a1`. Os pareceres especializados e a resolução dos antigos achados QA permanecem válidos.

**Nota não bloqueante:** o audit integral registra seis pacotes com severidade alta na cadeia de ferramentas de desenvolvimento. Registrar acompanhamento separado; dependências de desenvolvimento também representam risco, embora o audit de produção esteja limpo.

O Stage4 remoto **continua FAILURE por cobrança**. Esta aprovação reconhece o gate local autorizado, sem atribuir SUCCESS ao GitHub nem autorizar migrations, merge ou produção.

Git antes/depois: somente `HANDOFF.md` previamente modificado pelo mantenedor; nenhuma mutação desta revisão.

```text
SKILL_RESULT: running-release-gate
STATUS: PASS
SCOPE: QA/integração da Etapa 9 por execução local autorizada
```

**Próximo passo exato:** project-maintainer persistir logs/resultados, autorização, notas do audit e este parecer na PR/HANDOFF; registrar o fechamento da Etapa 9 e iniciar a Etapa 10 conforme o plano.
