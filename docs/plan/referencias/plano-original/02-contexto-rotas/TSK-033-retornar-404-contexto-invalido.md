---
id: TSK-033
tipo: roteamento
dependencias: [TSK-031, TSK-032]
risco: medio
---

# Retornar 404 para contexto inválido

## Objetivo

Impedir que combinações inexistentes exibam dados vazios ou de outra competição.

## Escopo permitido

Loader/beforeLoad da rota contextual e teste de rota.

## Passos

1. Distinguir falha de rede de contexto inexistente.
2. Mapear `null` para not-found do TanStack Router.
3. Não redirecionar silenciosamente para contexto padrão.
4. Testar ano inválido, série inválida e categoria inválida.
5. Testar erro transitório sem convertê-lo em 404.

## Critérios de aceite

- Somente inexistência retorna 404.
- Nenhuma consulta de recurso roda após contexto inválido.
- Página de erro não revela detalhes internos.

## Não alterar

Página raiz ou seletor.
