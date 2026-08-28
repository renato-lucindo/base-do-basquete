# ADM-REF-02E — Enforcement de novos jogos em confrontos

> [← ADM-REF-02D](ADM-REF-02D.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-03A →](../03-ingestao-conciliacao/ADM-REF-03A.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `CONDITIONAL`
- **Entrada obrigatória:** fluxos de criação/importação adaptados e histórico encapsulado.
- **Objetivo:** bloquear novos jogos fora de confronto válido.
- **Ler:** `M` §§11 e 13; `I` §§5, 9 e 10.
- **Entregar:** migration nova, RPCs atualizadas, tipos e negações de escrita direta.
- **Não incluir:** editor, progressão ou reclassificação do histórico.
- **Gate:** `G-DB` + regressão de súmula/importação.
- **Concluída quando:** nenhum fluxo novo contorna o vínculo e o histórico continua legível.
