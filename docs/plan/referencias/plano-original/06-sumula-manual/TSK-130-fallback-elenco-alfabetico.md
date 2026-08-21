---
id: TSK-130
tipo: dominio-frontend
dependencias: [TSK-128, TSK-129]
risco: baixo
---

# Aplicar fallback alfabético no primeiro jogo

## Objetivo

Pré-selecionar até 12 inscritos quando não houver partida anterior.

## Escopo permitido

Função pura de prefill e testes.

## Passos

1. Se houver relação anterior, usá-la.
2. Caso contrário, ordenar inscritos por nome de forma estável.
3. Selecionar no máximo 12.
4. Não alterar a lista original.
5. Testar menos, exatamente e mais de 12.

## Critérios de aceite

- Fallback só ocorre sem histórico válido.
- Ordem é determinística.
- Nenhum não inscrito é incluído.

## Não alterar

Consulta ou UI dos slots.
