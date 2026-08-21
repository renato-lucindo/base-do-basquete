---
id: TSK-020
tipo: banco
dependencias: [TSK-005, TSK-017, TSK-019]
risco: alto
---

# Definir persistência de faltas e desqualificação

## Objetivo

Persistir faltas P, T, U/U2 e D de modo consultável, preservando o evento que causa GD.

## Escopo permitido

Modelo de faltas/estatística existente, checks e testes SQL.

## Passos

1. Auditar se faltas estão em JSON, array, contagem ou eventos.
2. Definir códigos canônicos conforme o domínio já adotado.
3. Definir como GD é derivada e, se persistida, como evitar divergência.
4. Garantir ordem por período/instante quando necessária.
5. Testar combinações do requisito.

## Critérios de aceite

- Backend consegue recalcular GD a partir dos dados autoritativos.
- Código de falta inválido é recusado.
- Não há dois campos concorrentes com estados divergentes.

## Não alterar

Trava de UI ou RPC de atualização; tarefas posteriores cuidam disso.
