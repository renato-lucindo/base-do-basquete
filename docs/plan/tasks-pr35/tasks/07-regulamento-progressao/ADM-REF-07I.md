# ADM-REF-07I — Encerramento de classificatória/grupos

> [← ADM-REF-07H](ADM-REF-07H.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-07J →](ADM-REF-07J.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `BLOCKED` por `07H`
- **Objetivo:** propagar posições somente após classificação validada.
- **Ler:** `M` §§8.2 e 13; `I` §§7–9; `A` §9.7.1.
- **Entregar:** RPC separada, snapshot da tabela, desempates/entradas fechados e resolução das vagas posteriores.
- **Não incluir:** usar tabela provisória, publicar jogos ou alterar regras de desempate na UI.
- **Gate:** `G-DB`.
- **Concluída quando:** tabela provisória não troca participantes futuros.
