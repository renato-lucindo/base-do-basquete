---
id: TSK-145
tipo: frontend-dominio
dependencias: [TSK-019, TSK-137, TSK-140]
risco: medio
---

# Adicionar OT sob demanda

## Objetivo

Criar OT1, OT2... em sequência quando o jogo precisar de prorrogação.

## Escopo permitido

Ação de adicionar período e testes.

## Passos

1. Permitir OT após Q4.
2. Numerar sequencialmente.
3. Impedir lacunas/duplicidades.
4. Definir remoção apenas de OT final vazio.
5. Recalcular totais automaticamente.

## Critérios de aceite

- Quantidade de OTs é dinâmica.
- Estado e payload preservam ordem.
- Remoção não apaga dados sem confirmação.

## Não alterar

Regra de encerramento.
