# ADM-REF-03B — Súmula no jogo existente

> [← ADM-REF-03A](ADM-REF-03A.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-03C →](ADM-REF-03C.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `03A`
- **Objetivo:** confirmar súmula como submissão do jogo/confronto já existente.
- **Ler:** `M` §§7.1 e 8; `I` §§9 e 11.4.
- **Entregar:** seleção do jogo, RPC transacional, idempotência, autoridades compatíveis e preservação do fluxo compacto atual.
- **Não incluir:** fallback de edição boxscore ou boxscore suplementar.
- **Gate:** `G-FLOW`.
- **Concluída quando:** nenhuma confirmação cria segundo jogo e repetição devolve a submissão existente.
