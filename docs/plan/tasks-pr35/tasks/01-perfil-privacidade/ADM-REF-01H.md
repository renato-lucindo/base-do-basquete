# ADM-REF-01H — Enforcement final de naipe/perfil

> [← ADM-REF-01G](ADM-REF-01G.md) · [Fila](../../03-FILA-E-DEPENDENCIAS.md) · [ADM-REF-02A →](../02-submissoes-autoridade/ADM-REF-02A.md)

> Antes de editar: leia [Como usar](../../00-COMO-USAR.md), [Regras globais](../../01-REGRAS-GLOBAIS.md), [Protocolo e gates](../../02-PROTOCOLO-E-GATES.md) e confirme este cartão na [fila](../../03-FILA-E-DEPENDENCIAS.md).

- **Estado:** `CONDITIONAL`
- **Entrada obrigatória:** filas de naipe/perfil zeradas no ambiente alvo e autorização para aplicar a etapa de imposição.
- **Objetivo:** tornar obrigatórias as invariantes finais sem interromper histórico.
- **Ler:** `M` §§5, 11 e 19; `I` §§10, 17 e 22.
- **Entregar:** migration corretiva/final nova; `NOT NULL`/FK/unicidade finais; novas escritas sem resolver legado; relatório pós-migration.
- **Não incluir:** apagar atletas com sexo nulo, alterar URLs históricas à força ou remover colunas legadas ainda consumidas.
- **Gate:** `G-DB` + base representativa.
- **Concluída quando:** nenhuma linha inválida existe e aplicações antiga/nova obedecem ao plano de rollout acordado.
