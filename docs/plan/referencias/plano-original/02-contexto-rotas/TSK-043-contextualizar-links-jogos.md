---
id: TSK-043
tipo: frontend
dependencias: [TSK-016, TSK-038]
risco: alto
---

# Contextualizar links e detalhes de jogos

## Objetivo

Abrir o jogo somente quando seu `competition_id` corresponder ao contexto da URL.

## Escopo permitido

Links de jogo, loader/consulta do detalhe contextual e testes.

## Passos

1. Gerar link contextual para o jogo.
2. Carregar jogo por ID e validar `competition_id`.
3. Retornar 404 para ID existente em outro contexto.
4. Preservar a rota `/games/$gameId` apenas conforme compatibilidade definida.
5. Testar IDs cruzados entre competições.

## Critérios de aceite

- Não há vazamento de jogo entre contextos.
- Página recarrega diretamente.
- Recursos avançados respeitam capacidades da categoria.

## Não alterar

Persistência do jogo ou parser.
