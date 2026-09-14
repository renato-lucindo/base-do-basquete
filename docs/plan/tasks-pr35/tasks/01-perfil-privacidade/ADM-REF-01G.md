# ADM-REF-01G — Classificação/backfill administrativo

> [← ADM-REF-01F](ADM-REF-01F.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-01H →](ADM-REF-01H.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `DONE`
- **Objetivo:** persistir escolhas explícitas e produzir relatório de reconciliação sem alterar o histórico.
- **Ler:** `M` §§11.1, 11.2, 11.5 e 15; `I` §10.
- **Entregar:** migration nova de classificação; filas por edição/atleta; snapshots por edição quando perfis divergirem; contagens antes/depois; nenhuma escolha automática de sexo ou naipe.
- **Não incluir:** `NOT NULL`, remoção de fallback, reinterpretação de edições mistas/vazias.
- **Gate:** `G-DB`.
- **Concluída quando:** relatório explica todas as diferenças e identifica com precisão o que ainda impede enforcement.

## Evidência de conclusão — 02/09/2026

Relatório administrativo v2 aplicado nas migrations remotas `20260902114439` e `20260902115601`. A reconciliação preservou as contagens e checksums históricos, não inferiu sexo ou naipe e identificou exatamente 2 edições sem naipe, 2 sem perfil e 44 atletas pendentes. Gate local, 40 pgTAP, banco desde zero, preview e CodeQL passaram nos commits `c474540` e `e14d672`. Detalhes em `docs/execution/ADM-REF-01G.md`.
