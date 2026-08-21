---
id: TSK-135
tipo: frontend
dependencias: [TSK-106, TSK-131, TSK-134]
risco: medio
---

# Bloquear camisas duplicadas na UI

## Objetivo

Alertar quando dois slots ativos do mesmo time usam a mesma string de camisa.

## Escopo permitido

Validador do editor e testes.

## Passos

1. Considerar somente slots ativos.
2. Normalizar pela função de `TSK-106`.
3. Comparar por equipe, não entre adversários.
4. Marcar todos os campos envolvidos.
5. Bloquear salvamento enquanto houver conflito.

## Critérios de aceite

- `"00"` e `"0"` são distintos.
- Duplicidade no adversário não bloqueia.
- Erro some ao corrigir ou marcar N/A.

## Não alterar

Validação do backend.
