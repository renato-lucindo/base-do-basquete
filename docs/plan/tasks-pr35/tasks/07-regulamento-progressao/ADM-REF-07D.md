# ADM-REF-07D — Compilar, validar e ativar regulamento

> [← ADM-REF-07C](ADM-REF-07C.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-07E →](ADM-REF-07E.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `07C`
- **Objetivo:** tornar o banco autoridade dos contratos esportivos.
- **Ler:** `M` §13; `I` §§5–9; `A` §8.6.
- **Entregar:** domínio puro, RPCs transacionais, bloqueio de rodada, limites de oitavas/quartas/semifinal/final, idempotência e ativação atômica.
- **Não incluir:** editor completo ou progressão de resultados.
- **Gate:** `G-DB` + testes de domínio/concorrência.
- **Concluída quando:** terceiro confronto de semifinal falha mesmo sob concorrência.
