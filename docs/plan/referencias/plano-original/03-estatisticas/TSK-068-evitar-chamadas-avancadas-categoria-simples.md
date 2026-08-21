---
id: TSK-068
tipo: desempenho-frontend
dependencias: [TSK-050, TSK-058, TSK-064]
risco: medio
---

# Evitar chamadas avançadas em categoria simples

## Objetivo

Provar que a interface simplificada não busca nem processa dados avançados.

## Escopo permitido

Composição da página de estatísticas e teste de chamadas.

## Passos

1. Derivar capacidade antes de criar a query.
2. Solicitar DTO simples.
3. Não montar comparação, filtros ou tabela avançada.
4. Verificar bundle/renderização quando aplicável.
5. Espionar chamadas no teste.

## Critérios de aceite

- Nenhuma consulta avançada ocorre.
- DOM não contém controles ocultos avançados.
- Troca de contexto limpa estado incompatível.

## Não alterar

Política de capacidades.
