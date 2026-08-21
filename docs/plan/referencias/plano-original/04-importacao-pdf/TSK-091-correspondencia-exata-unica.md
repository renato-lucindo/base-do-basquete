---
id: TSK-091
tipo: dominio
dependencias: [TSK-090]
risco: medio
---

# Resolver correspondência exata única

## Objetivo

Associar automaticamente somente quando uma única pessoa corresponder exatamente à forma normalizada.

## Escopo permitido

Função de match exato e testes.

## Passos

1. Normalizar entrada e candidatos.
2. Retornar candidato somente se houver exatamente um.
3. Retornar ambíguo para duplicidades.
4. Não usar equipe global como desempate oculto.
5. Testar zero, um e múltiplos candidatos.

## Critérios de aceite

- Associação automática é explicável.
- Ambiguidade exige revisão.
- Função não cria jogador.

## Não alterar

Sugestões aproximadas.
