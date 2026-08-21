---
id: TSK-149
tipo: teste
dependencias: [TSK-121, TSK-127, TSK-132, TSK-133, TSK-135, TSK-136, TSK-138, TSK-143, TSK-144, TSK-145, TSK-146, TSK-148]
risco: baixo
---

# Testar súmula manual ponta a ponta

## Objetivo

Provar seleção contextual, regras de jogo e atomicidade.

## Escopo permitido

Testes unitários, SQL, componente e integração.

## Cenários

1. Acesso sem permissão.
2. Equipe/atleta fora da edição.
3. Prefill anterior e fallback alfabético.
4. N/A e camisa duplicada.
5. Pontos por período e totais.
6. Cada gatilho de GD e tentativa pós-GD.
7. Empate, OT1 e OT2.
8. Falha intermediária com rollback e sucesso com navegação.

## Critérios de aceite

- Testes provam validações no cliente e no backend.
- Nenhum dado parcial sobrevive.
- Cache da competição é invalidado após sucesso.

## Não alterar

Código de produto nesta tarefa.
