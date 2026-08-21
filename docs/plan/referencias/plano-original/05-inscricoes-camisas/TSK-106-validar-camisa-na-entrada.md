---
id: TSK-106
tipo: dominio
dependencias: [TSK-018]
risco: medio
---

# Validar número de camisa como texto

## Objetivo

Normalizar entrada sem perder `"00"` e sem aceitar formatos indevidos.

## Escopo permitido

Função pura usada por importação e súmula manual, mais testes.

## Passos

1. Receber string.
2. Remover somente espaços externos.
3. Validar conjunto de formatos definido.
4. Preservar `"00"` e diferenciar de `"0"`.
5. Retornar erro estruturado.

## Critérios de aceite

- Nenhum `Number()` participa da normalização.
- Importação e editor compartilham a função.
- Casos válidos e inválidos têm teste.

## Não alterar

Schema ou frequência histórica.
