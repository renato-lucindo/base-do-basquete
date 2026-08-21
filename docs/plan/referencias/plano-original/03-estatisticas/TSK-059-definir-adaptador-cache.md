---
id: TSK-059
tipo: arquitetura
dependencias: [TSK-007, TSK-058]
risco: alto
---

# Definir adaptador de cache

## Objetivo

Escolher cache compatível com a implantação real, sem acoplar regra de negócio a Redis, memória local ou Cloudflare.

## Escopo permitido

Interface de cache, decisão arquitetural e testes com implementação falsa.

## Passos

1. Confirmar runtime de produção e instâncias.
2. Avaliar Cache API/KV, serviço externo ou memória apenas para desenvolvimento.
3. Definir `get`, `set`, `delete` e TTL.
4. Definir comportamento fail-open controlado.
5. Proibir segredo ou dado pessoal na chave/valor.

## Critérios de aceite

- Escolha funciona em múltiplas instâncias.
- Falha do cache não corrompe resultado.
- Implementação pode ser trocada sem mudar agregações.

## Não alterar

Consulta, invalidação ou configuração de produção.
