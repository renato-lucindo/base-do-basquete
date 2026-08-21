---
id: TSK-003
tipo: auditoria
dependencias: [TSK-001, TSK-002]
risco: baixo
---

# Construir matriz de implementação e lacunas

## Objetivo

Evitar recriar funções que o resumo das últimas 24 horas afirma já estarem no `main`.

## Escopo permitido

Somente inspeção de código, migrations, testes e histórico relevante.

## Passos

1. Criar uma linha para cada tarefa funcional deste pacote.
2. Classificar como `ausente`, `parcial`, `presente sem teste`, `presente e testada` ou `inconclusiva`.
3. Vincular evidência por caminho, símbolo, migration e teste.
4. Não considerar texto de resumo como prova suficiente.
5. Bloquear implementação quando a evidência for inconclusiva.

## Critérios de aceite

- Todas as tarefas possuem estado e evidência.
- Funções existentes não geram tarefas duplicadas de implementação.
- Lacunas têm descrição observável e reproduzível.

## Não alterar

Código, banco ou testes.
