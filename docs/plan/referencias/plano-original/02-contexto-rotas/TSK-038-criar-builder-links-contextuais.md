---
id: TSK-038
tipo: frontend-dominio
dependencias: [TSK-030, TSK-032]
risco: baixo
---

# Criar builder de links contextuais

## Objetivo

Centralizar a montagem de URLs de recursos e detalhes.

## Escopo permitido

Utilitário puro de rotas e testes unitários.

## Passos

1. Aceitar `CompetitionContext`, recurso e parâmetros de detalhe.
2. Codificar segmentos com segurança.
3. Restringir recursos a união tipada.
4. Não aceitar `competitionId` como segmento público.
5. Testar equipe, jogador, jogo e recurso simples.

## Critérios de aceite

- Não há concatenação duplicada espalhada pelos componentes novos.
- Slugs especiais válidos são codificados corretamente.
- Recursos inválidos falham em compilação.

## Não alterar

Componentes de header ou tabelas.
