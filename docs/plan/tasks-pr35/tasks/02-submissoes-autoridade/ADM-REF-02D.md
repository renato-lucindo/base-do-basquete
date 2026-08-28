# ADM-REF-02D — Invólucro estrutural legado e vínculo opcional

> [← ADM-REF-02C](ADM-REF-02C.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-02E →](ADM-REF-02E.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `02C`
- **Objetivo:** criar a fundação mínima para vincular jogos a confrontos sem inventar fases históricas.
- **Ler:** `M` §§11 e 13; `I` §§5, 6 e 10; `A` §9.7.
- **Entregar:** estrutura mínima versionada, `legacy_unclassified`, `games.matchup_id` anulável, integridade de competição e relatório de não classificados.
- **Não incluir:** editor, progressão, classificação automática ou `NOT NULL`.
- **Gate:** `G-DB`.
- **Concluída quando:** todo jogo é preservado e os casos não comprováveis ficam explicitamente não classificados.
