# ADM-REF-01C — Revisão administrativa de naipe e perfil

> [← ADM-REF-01B](ADM-REF-01B.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-01D →](ADM-REF-01D.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `READY`
- **Objetivo:** permitir que admin AAL2 classifique uma edição pendente e vincule/crie/ative o perfil compatível.
- **Ler:** `M` §§5, 11 e 12; `I` §§11–13 e 17; `A` §5.
- **Caminhos iniciais:** rota do hub/edição, módulo server de competições, componentes de formulário, testes da rota.
- **Entregar:** loader privado de pendências; action por intents pequenas; seleção sem sugestão inferida; prévia de impacto; consumo exclusivo das RPCs aprovadas; estados vazio/erro/sucesso.
- **Não incluir:** formulário de sexo, elegibilidade de elenco, criação completa de edição ou enforcement final.
- **Gate:** `G-FLOW`.
- **Concluída quando:** uma edição pendente é revisada em AAL2, combinação incompatível é recusada e nenhuma informação privada entra na resposta.
