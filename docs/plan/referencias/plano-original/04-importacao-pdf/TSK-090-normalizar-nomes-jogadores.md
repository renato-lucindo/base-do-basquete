---
id: TSK-090
tipo: dominio
dependencias: [TSK-006]
risco: medio
---

# Normalizar nomes para correspondência

## Objetivo

Criar forma comparável sem destruir o nome original.

## Escopo permitido

Função pura de normalização e testes.

## Passos

1. Preservar valor original.
2. Definir caixa, espaços, diacríticos e pontuação.
3. Não remover tokens que possam diferenciar pessoas sem decisão explícita.
4. Tratar valor vazio.
5. Testar nomes parecidos e distintos.

## Critérios de aceite

- Normalização é determinística.
- Nome exibido/cadastrado não é sobrescrito.
- Casos ambíguos permanecem ambíguos.

## Não alterar

Algoritmo de similaridade.
