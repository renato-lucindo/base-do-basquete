# ADM-REF-02C — Backfill de submissões e autoridades

> [← ADM-REF-02B](ADM-REF-02B.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-02D →](ADM-REF-02D.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `READY`
- **Objetivo:** encapsular jogos atuais sem mudar fatos esportivos.
- **Ler:** `M` §§11.3–11.5; `I` §10.
- **Entregar:** migration nova de backfill para manual/boxscore/seed; relatório de hashes, placares, pontos, faltas e cobertura; `legacy_seed` somente histórico.
- **Não incluir:** classificar fase por número do jogo ou impor confronto obrigatório.
- **Gate:** `G-DB` com checksums antes/depois.
- **Concluída quando:** IDs e resultados permanecem iguais e cada domínio ativo tem origem explicável.
