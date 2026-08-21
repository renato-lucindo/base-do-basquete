---
id: TSK-062
tipo: integracao
dependencias: [TSK-060, TSK-061, TSK-083]
risco: alto
---

# Invalidar cache após importação de PDF

## Objetivo

Remover somente as chaves da competição confirmada após commit bem-sucedido.

## Escopo permitido

Orquestração pós-commit do importador e teste.

## Passos

1. Obter `competition_id` da transação confirmada.
2. Invalidar variantes simples e avançadas dessa competição.
3. Executar invalidação somente após sucesso do banco.
4. Registrar falha de invalidação para reparo.
5. Testar importação revertida e confirmada.

## Critérios de aceite

- Outra competição mantém o cache.
- Transação com rollback não invalida.
- Próxima leitura após sucesso recalcula dados.

## Não alterar

Parser ou conteúdo importado.
