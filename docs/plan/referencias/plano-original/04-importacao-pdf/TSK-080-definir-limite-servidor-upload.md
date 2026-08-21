---
id: TSK-080
tipo: arquitetura-seguranca
dependencias: [TSK-005, TSK-007, TSK-023]
risco: alto
---

# Definir limite autoritativo do upload

## Objetivo

Decidir onde autenticação, tamanho, rate limit e chamada transacional são aplicados no stack TanStack Start + Supabase.

## Escopo permitido

Decisão arquitetural e esqueleto mínimo somente se o limite atual for inseguro.

## Passos

1. Auditar se o navegador escreve diretamente no Supabase.
2. Identificar quais garantias exigem servidor/RPC.
3. Definir responsabilidades entre cliente, função server-side e RPC.
4. Evitar colocar segredo de serviço no cliente.
5. Registrar fluxo de dados e erros.

## Critérios de aceite

- Existe um limite confiável para autorização e rate limit.
- RLS continua como defesa independente.
- Nenhum controle crítico depende só de botão oculto.

## Não alterar

Parser ou esquema do boxscore.
