# ADM-REF-05A — Read model boxscore orientado por autoridade

> [← ADM-REF-04E](../04-jogadores-sumula/ADM-REF-04E.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-05B →](ADM-REF-05B.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `04E`
- **Objetivo:** trocar internamente a fonte dos dados avançados sem mudar o contrato visual normal.
- **Ler:** `M` §§9.2 e 10; `I` §§11.3, 11.5 e 11.6.
- **Entregar:** `gamesPlayed` versus `advancedGamesPlayed`, pontos oficiais versus avançados, denominadores reais e aviso somente para cobertura incompleta.
- **Não incluir:** redesign, nova nomenclatura ou remoção de controles.
- **Gate:** `G-DB` + `G-DOMAIN`.
- **Concluída quando:** fallback manual conta nos básicos e não contamina médias/eficiência avançadas.
