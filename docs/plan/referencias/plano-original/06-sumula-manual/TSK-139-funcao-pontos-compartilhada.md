---
id: TSK-139
tipo: dominio
dependencias: [TSK-006]
risco: alto
---

# Criar função compartilhada de pontos

## Objetivo

Calcular `2 × bolas2 + 3 × bolas3 + lancesLivres` no cliente e validar com a mesma regra no backend.

## Escopo permitido

Função pura, equivalente SQL/RPC e testes com mesmos vetores.

## Passos

1. Validar inteiros não negativos.
2. Calcular sem estado.
3. Reusar no editor/importador quando compatível.
4. Executar novamente no backend.
5. Testar limites e múltiplos períodos.

## Critérios de aceite

- Cliente e backend produzem mesmo resultado.
- Pontos totais não são aceitos como fonte independente.
- Casos inválidos falham.

## Não alterar

Renderização do placar.
