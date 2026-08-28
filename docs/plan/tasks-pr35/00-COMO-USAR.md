# Como usar este pacote

> Entrada operacional: [README](README.md) · [Regras](01-REGRAS-GLOBAIS.md) · [Protocolo e gates](02-PROTOCOLO-E-GATES.md) · [Fila](03-FILA-E-DEPENDENCIAS.md)

No arquivo ZIP, as fontes `M`, `I`, `A` e `H` ficam em `fontes/`; o contexto atual fica em `contexto/`. No repositório, `M` permanece no diretório pai e as demais fontes anexadas conservam os caminhos registrados abaixo.

Este documento converte o plano mestre e as instruções de refatoração em unidades de execução pequenas, seriadas e retomáveis. Ele não altera decisões de produto: organiza a implementação para impedir mistura de features, migrations difíceis de reverter, regressões silenciosas e perda de contexto entre sessões.

Fontes normativas, em ordem de precedência:

1. instrução explícita mais recente do responsável;
2. `AGENTS.md` e `HANDOFF.md`;
3. `PLANO-MESTRE-PR-FONTES-DE-DADOS-E-JOGADORES.md`;
4. `INSTRUCOES-IMPLEMENTACAO-REFATORACAO-ADMIN-E-REGULAMENTO.md` e `PLANO-REFATORACAO-ADMIN-CAMPEONATOS-E-EQUIPES.md`, preservados como referências do planejamento aprovado;
5. este plano operacional, apenas para ordem, fronteiras e retomada.

Este documento não autoriza merge, produção, exclusão de dados, alteração destrutiva de serviços ou exposição de informações privadas.

As referências usadas nos cartões são:

- `M`: no repositório, `../PLANO-MESTRE-PR-FONTES-DE-DADOS-E-JOGADORES.md`; no ZIP, `fontes/PLANO-MESTRE-PR-FONTES-DE-DADOS-E-JOGADORES.md`.
- `I`: no ZIP, `fontes/INSTRUCOES-IMPLEMENTACAO-REFATORACAO-ADMIN-E-REGULAMENTO.md`; origem anexada preservada no manifesto.
- `A`: no ZIP, `fontes/PLANO-REFATORACAO-ADMIN-CAMPEONATOS-E-EQUIPES.md`; origem anexada preservada no manifesto.
- `H`: no ZIP, `fontes/HANDOFF.md`; origem anexada preservada no manifesto.

Uma sessão futura pode executar os cartões apenas com `M`, este arquivo e o `HANDOFF.md` do repositório. Consultar `I`, `A` e `H` para detalhes e rastreabilidade; se qualquer um deles divergir de `M` ou do estado real, prevalecem as fontes anteriores na lista de precedência.

## Baseline reconciliada

- PR alvo: `#35`, draft.
- Branch: `feature/admin-workflow-improvements`.
- Head documental na criação deste plano: `14be1bf`.
- Head funcional aprovado: `ccef3f1`.
- `ADM-REF-00`, `ADM-REF-01A` e `ADM-REF-01B` estão concluídas.
- Próxima task elegível: `ADM-REF-01C`.
- O arquivo não rastreado `public/__admin-preview.html` não pertence a estas tasks e deve continuar preservado.
- Merge e deploy de produção permanecem proibidos sem autorização específica.

Antes de iniciar qualquer task, reconciliar esses fatos com `git status`, `git log --oneline -10`, `HANDOFF.md` e a PR remota. O estado real prevalece sobre esta fotografia.
