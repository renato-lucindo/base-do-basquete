# ADM-REF-07G — Agendamento de partidas

> [← ADM-REF-07F](ADM-REF-07F.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-07H →](ADM-REF-07H.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `07F`
- **Objetivo:** criar/preparar partidas somente dentro de confronto válido.
- **Ler:** `M` §13; `I` §§6.5 e 15; `A` §9.7.
- **Entregar:** RPC e UI para rodada/confronto, ordem, data/hora/local/mando, participantes derivados e preparação privada com vagas pendentes.
- **Não incluir:** publicação ou placar fictício.
- **Gate:** `G-FLOW`.
- **Concluída quando:** jogo scheduled não aparece como 0×0 e não nasce fora do regulamento.
