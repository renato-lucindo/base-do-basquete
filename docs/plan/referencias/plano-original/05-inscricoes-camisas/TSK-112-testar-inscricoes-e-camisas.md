---
id: TSK-112
tipo: teste
dependencias: [TSK-101, TSK-102, TSK-105, TSK-106, TSK-111]
risco: baixo
---

# Testar inscrições, elencos e camisas

## Objetivo

Cobrir transações, conflito entre equipes e reconhecimento de numeração.

## Escopo permitido

Testes SQL, unitários e de componente.

## Cenários

1. Equipe duplicada.
2. Elenco salvo e rollback por falha.
3. Jogador em dois times na mesma edição.
4. Jogador em times diferentes em anos distintos.
5. `"00"` versus `"0"`.
6. Frequência, empate e ausência de histórico.

## Critérios de aceite

- Testes negativos provam constraints/RPCs.
- UI exibe erros padronizados.
- Nenhum teste altera dados externos.

## Não alterar

Código de produto nesta tarefa.
