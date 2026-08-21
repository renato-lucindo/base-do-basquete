---
id: TSK-123
tipo: dados-frontend
dependencias: [TSK-004, TSK-122]
risco: medio
---

# Listar categorias válidas

## Objetivo

Mostrar somente categorias pertencentes ao contexto selecionado, respeitando o modelo canônico.

## Escopo permitido

Consulta/opções do campo categoria e teste.

## Passos

1. Confirmar se a categoria já identifica a própria edição.
2. Evitar uma segunda entidade paralela.
3. Filtrar opções pelo campeonato/série quando necessário.
4. Limpar dependentes ao mudar categoria.
5. Testar campeonato com uma e várias categorias.

## Critérios de aceite

- Categoria de outro campeonato não aparece.
- Seleção fornece o `competition_id` final.
- Estado vazio é tratado.

## Não alterar

Schema nesta tarefa.
