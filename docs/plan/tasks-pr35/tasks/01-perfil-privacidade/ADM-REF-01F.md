# ADM-REF-01F — Elegibilidade na confirmação de importação

> [← ADM-REF-01E](ADM-REF-01E.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-01G →](ADM-REF-01G.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `READY`
- **Objetivo:** impedir que confirmação de importação associe atleta incompatível ou pendente.
- **Ler:** `M` §§5.5, 7.2 e 11; `I` §§11.7, 17 e 18.
- **Entregar:** integração da regra na transação existente; retorno de pendências por atleta sem sexo exposto; parser continua sem inferência; import permanece em review na falha.
- **Não incluir:** novo modelo de submissões, fallback ou suplemento.
- **Gate:** `G-FLOW` com os dois PDFs fixture.
- **Concluída quando:** import não contorna elegibilidade e não deixa escrita parcial.
