---
id: TSK-067
tipo: frontend
dependencias: [TSK-050, TSK-065, TSK-066]
risco: medio
---

# Implementar filtros >=, <=, < e >

## Objetivo

Filtrar métricas avançadas com operador e valor validados.

## Escopo permitido

Componente/estado de filtro e testes.

## Passos

1. Restringir métricas filtráveis.
2. Tipar os quatro operadores.
3. Validar número, escala e vazio.
4. Aplicar filtro no modo visual atual.
5. Definir combinação de múltiplos filtros.

## Critérios de aceite

- Entrada inválida não filtra silenciosamente.
- Filtro não aparece em categoria simples.
- Casos de igualdade e zero são testados.

## Não alterar

Consulta remota, salvo decisão explícita de paginação.
