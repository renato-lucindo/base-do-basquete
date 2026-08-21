---
id: TSK-162
tipo: frontend-admin
dependencias: [TSK-160]
risco: medio
---

# Criar hub da edição

## Objetivo

Concentrar dados e ações exclusivas da competição selecionada.

## Escopo permitido

Rota/componente de hub e testes.

## Passos

1. Resolver `competition_id`.
2. Exibir ano, série, categoria e estado.
3. Carregar contagens resumidas sem buscar dados completos.
4. Oferecer ações autorizadas.
5. Tratar edição inexistente.

## Critérios de aceite

- Toda ação leva o contexto explicitamente.
- Mudança de edição limpa dados do hub anterior.
- Módulos globais continuam acessíveis fora do hub.

## Não alterar

Implementação interna das ações.
