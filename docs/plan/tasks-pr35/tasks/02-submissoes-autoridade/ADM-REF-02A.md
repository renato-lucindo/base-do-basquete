# ADM-REF-02A — Tabela de submissões versionadas

> [← ADM-REF-01H](../01-perfil-privacidade/ADM-REF-01H.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-02B →](ADM-REF-02B.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `01G` e pelo registro da execução ou do adiamento de `01H`
- **Objetivo:** separar a identidade do jogo das entradas manual/boxscore.
- **Ler:** `M` §§6.1, 6.2 e 11; `I` §§6, 10 e 11.
- **Entregar:** `game_data_submissions`, estados, papéis, hash/idempotência, RLS/grants/índices e tipos.
- **Não incluir:** autoridade por domínio, UI, backfill ou mudança nos fluxos atuais.
- **Gate:** `G-DB`.
- **Concluída quando:** duas fontes podem existir no mesmo `game_id` sem duas submissões ativas duplicadas da mesma versão.
