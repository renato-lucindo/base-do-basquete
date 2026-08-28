# ADM-REF-04B — DTO discriminado e loader scoresheet

> [← ADM-REF-04A](ADM-REF-04A.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-04C →](ADM-REF-04C.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `04A`
- **Objetivo:** resolver `scoresheet`/`boxscore` pelo perfil vinculado.
- **Ler:** `M` §§9.1 e 10; `I` §§11.1 e 11.6.
- **Entregar:** DTO sem campos opcionais ambíguos, loader server-side, busca/filtro/ordenação e testes de isolamento por naipe.
- **Não incluir:** componente final ou alteração visual do boxscore.
- **Gate:** `G-DOMAIN`.
- **Concluída quando:** nenhuma decisão usa `categories.has_advanced_stats` ou contagem de jogos.
