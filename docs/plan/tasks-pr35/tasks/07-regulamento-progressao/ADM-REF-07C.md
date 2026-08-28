# ADM-REF-07C — Vagas, confrontos e contrato de partidas

> [← ADM-REF-07B](ADM-REF-07B.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-07D →](ADM-REF-07D.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `07B`
- **Objetivo:** modelar origens tipadas, dois lados, bye, jogo único/ida-volta/melhor de N e vínculo do jogo.
- **Ler:** `M` §13; `I` §§6.4, 6.5 e 10; `A` §§9.7 e 9.7.1.
- **Entregar:** constraints/FKs/índices, detecção de ciclo e capacidade local, participantes concretos preservados.
- **Não incluir:** progressão ou criação livre pelo frontend.
- **Gate:** `G-DB`.
- **Concluída quando:** origem inválida/futura/cíclica e partida excedente são recusadas.
