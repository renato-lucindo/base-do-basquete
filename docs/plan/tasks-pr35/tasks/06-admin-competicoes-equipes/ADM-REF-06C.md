# ADM-REF-06C — Política transacional de remoção/retirada

> [← ADM-REF-06B](ADM-REF-06B.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-06D →](ADM-REF-06D.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `06B`
- **Objetivo:** banco decide entre remover inscrição provisória, retirar ou bloquear.
- **Ler:** `M` §13; `I` §§9, 13 e 17; `A` §7.
- **Entregar:** RPC AAL2, verificação/mutação na mesma transação, dependências, idempotência, auditoria e códigos estáveis.
- **Não incluir:** exclusão do cadastro global da equipe ou UI.
- **Gate:** `G-DB`.
- **Concluída quando:** histórico competitivo nunca é apagado e repetição é segura.
