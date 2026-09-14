# ADM-REF-08B — Resumo e regras temporais de publicação

> [← ADM-REF-08A](ADM-REF-08A.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-08C →](ADM-REF-08C.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `08A`
- **Objetivo:** calcular mudanças e bloquear publicação antes de `starts_on`.
- **Ler:** `M` §13; `I` §16; `A` §§9.2, 9.3 e 9.6.
- **Entregar:** resumo server-side, avisos/bloqueios, `America/Sao_Paulo`, idempotência e nenhuma rotina automática.
- **Não incluir:** UI final, publicação agendada ou mudança do estado esportivo.
- **Gate:** `G-DB` + domínio temporal.
- **Concluída quando:** chegar a data apenas habilita a ação e não publica conteúdo.
