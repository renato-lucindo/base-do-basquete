---
id: TSK-108
tipo: dominio-dados
dependencias: [TSK-107]
risco: medio
---

# Contar frequência de cada camisa

## Objetivo

Agrupar por valor textual e contar quantas partidas confirmadas usaram cada número.

## Escopo permitido

Consulta/transformação de frequência e testes.

## Passos

1. Agrupar por string canônica.
2. Contar jogos distintos quando necessário.
3. Manter `"00"` separado de `"0"`.
4. Ordenar inicialmente por contagem decrescente.
5. Retornar também a data mais recente para desempate.

## Critérios de aceite

- Contagens batem com fixtures.
- Repetição interna do mesmo jogo não aumenta o total.
- Resultado inclui evidência suficiente para desempate.

## Não alterar

Regra de escolha do vencedor.
