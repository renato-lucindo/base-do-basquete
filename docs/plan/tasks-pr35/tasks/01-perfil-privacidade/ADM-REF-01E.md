# ADM-REF-01E — Elegibilidade em elenco e transferência

> [← ADM-REF-01D](ADM-REF-01D.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-01F →](ADM-REF-01F.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `DONE`
- **Objetivo:** validar sexo/naipe na mesma transação de nova associação esportiva.
- **Ler:** `M` §§5.5 e 11; `I` §§9, 17 e 18.
- **Entregar:** RPC/serviço autoritativo; códigos estáveis para pendente/incompatível; UI recebe apenas decisão; histórico existente preservado; criação inline usa o mesmo contrato.
- **Não incluir:** importação PDF, backfill histórico ou remoção de inscrição.
- **Gate:** `G-DB` + testes de domínio e rota.
- **Concluída quando:** associação compatível passa, incompatível/nula falha e repetição não duplica dados.
