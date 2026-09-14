# ADM-REF-04A — Read model de jogadores de súmula

> [← ADM-REF-03E](../03-ingestao-conciliacao/ADM-REF-03E.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-04B →](ADM-REF-04B.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `03E`
- **Objetivo:** produzir apenas métricas confiáveis de edição manual.
- **Ler:** `M` §§9.3 e 10; `I` §§11.3 e 11.6.
- **Entregar:** views `security_invoker` de edição/jogo, participação sem DNP, PTS, PTS/J, 2PC, 3PC, LLC, faltas e desqualificações, cobertura e índices medidos.
- **Não incluir:** percentuais, tentativas ou componente visual.
- **Gate:** `G-DB`.
- **Concluída quando:** ausência continua nula e fontes não são somadas no mesmo domínio.
