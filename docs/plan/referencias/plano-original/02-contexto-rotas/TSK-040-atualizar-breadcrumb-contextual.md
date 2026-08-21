---
id: TSK-040
tipo: frontend
dependencias: [TSK-038]
risco: baixo
---

# Atualizar breadcrumb contextual

## Objetivo

Exibir série, ano, categoria, recurso e detalhe com links coerentes.

## Escopo permitido

Componente de breadcrumb público e teste de renderização.

## Passos

1. Derivar rótulos do contexto resolvido.
2. Gerar links intermediários pelo builder.
3. Tratar nomes longos e detalhe ainda carregando.
4. Marcar o item atual semanticamente.
5. Testar recurso e detalhe.

## Critérios de aceite

- Nenhum rótulo depende diretamente de slug quando há nome.
- Links intermediários não saem do contexto.
- Acessibilidade do breadcrumb é mantida.

## Não alterar

Header ou consultas.
