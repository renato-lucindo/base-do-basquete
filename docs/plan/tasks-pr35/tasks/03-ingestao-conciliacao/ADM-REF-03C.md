# ADM-REF-03C — Boxscore no jogo existente

> [← ADM-REF-03B](ADM-REF-03B.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-03D →](ADM-REF-03D.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `03B`
- **Objetivo:** confirmar PDF como submissão vinculada ao jogo/confronto.
- **Ler:** `M` §§7.2 e 8; `I` §§9, 11.5 e 11.7.
- **Entregar:** resolução do jogo, revisão, transação atômica, deduplicação e autoridades suportadas; PDFs continuam privados.
- **Não incluir:** promoção de fallback ou UI de conflito.
- **Gate:** `G-FLOW` com os dois PDFs.
- **Concluída quando:** import não cria jogo paralelo e falhas não deixam dados parciais.
