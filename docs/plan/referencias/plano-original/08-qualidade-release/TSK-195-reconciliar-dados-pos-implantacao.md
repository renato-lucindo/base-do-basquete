---
id: TSK-195
tipo: release-banco
dependencias: [TSK-191, TSK-194]
risco: alto
---

# Reconciliar dados após implantação de staging

## Objetivo

Comparar contagens e invariantes antes/depois sem depender apenas da UI.

## Escopo permitido

Consultas de leitura e relatório.

## Passos

1. Comparar competições, inscrições, elencos e jogos.
2. Verificar órfãos e conflitos.
3. Verificar imports e súmulas parciais.
4. Verificar conquistas confirmadas.
5. Verificar pendências de migração.

## Critérios de aceite

- Diferenças esperadas são explicadas.
- Nenhuma perda/duplicação inexplicada.
- Falha bloqueia produção.

## Não alterar

Dados para “corrigir” a reconciliação.
