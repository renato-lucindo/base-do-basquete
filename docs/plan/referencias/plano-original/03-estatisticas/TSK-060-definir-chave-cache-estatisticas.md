---
id: TSK-060
tipo: dominio
dependencias: [TSK-057, TSK-059]
risco: medio
---

# Definir chave e versão do cache

## Objetivo

Evitar colisões entre edições, modos e versões de fórmula.

## Escopo permitido

Função pura de chave e testes.

## Passos

1. Incluir versão do schema/fórmula.
2. Incluir `competitionId`, capacidade e modo relevantes.
3. Normalizar segmentos.
4. Não depender apenas de slugs mutáveis.
5. Testar colisões com anos e categorias diferentes.

## Critérios de aceite

- Contextos distintos nunca compartilham chave.
- Mudança incompatível permite invalidar via versão.
- Função é determinística.

## Não alterar

Backend do cache.
