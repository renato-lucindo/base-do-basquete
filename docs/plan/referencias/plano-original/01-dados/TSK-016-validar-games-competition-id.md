---
id: TSK-016
tipo: banco
dependencias: [TSK-011, TSK-013]
risco: alto
---

# Validar vínculo de jogos à edição

## Objetivo

Garantir que cada jogo pertença a uma competição e use equipes inscritas nela.

## Escopo permitido

Tabela `games`, validação transacional/RPC e testes SQL.

## Passos

1. Confirmar `competition_id` obrigatório e indexado.
2. Detectar jogos legados sem competição.
3. Validar que mandante e visitante são distintos.
4. Validar que ambos possuem inscrição válida na edição.
5. Aplicar a regra no ponto de escrita autoritativo.

## Critérios de aceite

- Jogo não pode ficar sem edição.
- Equipe não inscrita é recusada.
- Dados legados incompatíveis são reportados antes da constraint.

## Não alterar

Placar, períodos ou interface.
