# ADM-REF-02B — Autoridade por domínio e estado derivado

> [← ADM-REF-02A](ADM-REF-02A.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-02C →](ADM-REF-02C.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `02A`
- **Objetivo:** garantir uma autoridade ativa compatível por jogo/domínio.
- **Ler:** `M` §§6.3, 8 e 10; `I` §§8, 9 e 11.2.
- **Entregar:** `game_data_domain_authority`, matriz de capacidades, RPCs de ativação, view derivada `game_data_status`, cobertura e testes concorrentes.
- **Não incluir:** comparação visual, adaptação de súmula/boxscore ou progressão.
- **Gate:** `G-DB`.
- **Concluída quando:** fonte incapaz é recusada, concorrência tem um vencedor e o estado não diverge das submissões.
