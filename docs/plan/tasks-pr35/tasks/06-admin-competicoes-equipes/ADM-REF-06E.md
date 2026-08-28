# ADM-REF-06E — Criação transacional de edição

> [← ADM-REF-07E](../07-regulamento-progressao/ADM-REF-07E.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-06F →](ADM-REF-06F.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `07E`
- **Objetivo:** criar edição privada com perfil e regulamento inicial coerentes.
- **Ler:** `M` §§5.3 e 13; `I` §12; `A` §8.
- **Entregar:** normalização, ano 1900–ano seguinte, novo ano dinâmico, unicidade por naipe, período, perfil obrigatório e clonagem escolhida em uma operação idempotente.
- **Não incluir:** wizard visual ou publicação.
- **Gate:** `G-DB` + domínio.
- **Concluída quando:** falha não deixa edição parcial e novo ano não exige tabela auxiliar.
