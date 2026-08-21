---
id: TSK-163
tipo: frontend-admin
dependencias: [TSK-162, TSK-120, TSK-080]
risco: baixo
---

# Separar Súmula Manual e Importar Boxscore

## Objetivo

Apresentar dois fluxos distintos, ambos herdando a edição do hub.

## Escopo permitido

Cards/botões do hub e teste de navegação.

## Passos

1. Criar ação para súmula manual.
2. Criar ação para importação PDF conforme implementação real.
3. Passar `competition_id` sem hardcode.
4. Descrever quando usar cada fluxo.
5. Respeitar permissão/feature flag.

## Critérios de aceite

- Ações não compartilham estado acidentalmente.
- Contexto é mantido.
- Usuário não autorizado não executa a ação.

## Não alterar

Editores.
