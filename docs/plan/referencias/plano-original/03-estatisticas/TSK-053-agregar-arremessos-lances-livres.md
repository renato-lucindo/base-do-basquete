---
id: TSK-053
tipo: dados
dependencias: [TSK-051]
risco: alto
---

# Agregar arremessos e lances livres

## Objetivo

Somar AC/AT, 3PC/3PT e LLC/LLT sem calcular média de percentuais por jogo.

## Escopo permitido

Consulta/RPC e teste específico.

## Passos

1. Mapear acertos e tentativas autoritativos.
2. Somar numeradores e denominadores.
3. Não fazer média simples de percentuais.
4. Tratar tentativa zero.
5. Validar acertos nunca maiores que tentativas.

## Critérios de aceite

- Percentual futuro pode ser calculado pelos totais.
- Denominador zero tem representação definida.
- Dados inválidos são detectados.

## Não alterar

Formatação de porcentagem na UI.
