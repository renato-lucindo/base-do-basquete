---
id: TSK-034
tipo: dados-frontend
dependencias: [TSK-011, TSK-030]
risco: medio
---

# Definir contexto mais recente

## Objetivo

Criar consulta determinística para o destino padrão da aplicação.

## Escopo permitido

Consulta de competições ativas e teste unitário/de integração.

## Passos

1. Definir ordenação por ano e desempate estável.
2. Excluir edições inativas se o contrato exigir.
3. Retornar contexto completo, não apenas ID.
4. Tratar ausência total de competições.
5. Testar anos iguais e estados inativos.

## Critérios de aceite

- Resultado é determinístico.
- Não há competição hardcoded.
- Estado vazio possui comportamento explícito.

## Não alterar

Redirecionamento da raiz.
