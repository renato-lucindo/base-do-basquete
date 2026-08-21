---
id: TSK-196
tipo: release
dependencias: [TSK-187, TSK-193, TSK-194, TSK-195]
risco: alto
---

# Planejar release de produção

## Objetivo

Definir sequência, responsáveis, observação e critérios de abortar.

## Escopo permitido

Runbook; sem deploy.

## Passos

1. Fixar SHA e migrations.
2. Ordenar banco compatível, aplicação e flags.
3. Definir smoke mínimo imediato.
4. Definir métricas e janela de observação.
5. Definir gatilhos e passos de rollback sem apagar dados.

## Critérios de aceite

- Cada ação tem responsável e verificação.
- Rollback referencia versão anterior válida.
- Há plano para falha de migration e cache.

## Não alterar

Produção.
