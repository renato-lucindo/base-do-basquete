---
id: TSK-044
tipo: roteamento
dependencias: [TSK-007, TSK-032, TSK-033, TSK-043]
risco: alto
---

# Preservar `/admin` e definir compatibilidade legada

## Objetivo

Impedir interpretação de `admin` como ano e evitar quebra abrupta de links existentes.

## Escopo permitido

Árvore de rotas, redirects legados estritamente necessários e testes.

## Passos

1. Provar precedência/separação da rota autenticada.
2. Testar `/admin` autenticado, não autenticado e subrotas.
3. Inventariar URLs públicas antigas.
4. Definir redirect apenas quando o contexto puder ser resolvido sem ambiguidade.
5. Retornar erro explícito quando não houver contexto seguro.

## Critérios de aceite

- Painel administrativo mantém permissões e telas.
- Nenhum redirect escolhe competição arbitrariamente.
- Testes de regressão cobrem URLs críticas.

## Não alterar

Componentes internos do painel.
