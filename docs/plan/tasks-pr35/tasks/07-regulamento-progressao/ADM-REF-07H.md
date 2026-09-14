# ADM-REF-07H — Validação e progressão de confronto

> [← ADM-REF-07G](ADM-REF-07G.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-07I →](ADM-REF-07I.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `07G` e `03D`
- **Objetivo:** resolver confronto explicitamente pelo `official_result` ativo.
- **Ler:** `M` §§8.2 e 13; `I` §§7–9; `A` §9.7.1.
- **Entregar:** locks determinísticos, idempotência, resolução imutável, vagas dependentes, participantes privados e `ready_to_schedule`; sem publicar.
- **Não incluir:** publicação, edição de jogo concluído ou nova regra de autoridade de dados.
- **Gate:** `G-DB` + fluxo ponta a ponta.
- **Concluída quando:** vencedor/perdedor progride uma vez e draft/review nunca progride.
