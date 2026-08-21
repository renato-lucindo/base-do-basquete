---
id: TSK-143
tipo: frontend
dependencias: [TSK-141, TSK-142]
risco: alto
---

# Travar entradas posteriores à GD

## Objetivo

Desabilitar visualmente estatísticas posteriores ao evento de desqualificação.

## Escopo permitido

Estado/renderização da linha do atleta e testes.

## Passos

1. Determinar período/ordem do gatilho.
2. Manter dados anteriores editáveis conforme contrato.
3. Desabilitar períodos posteriores.
4. Explicar o motivo da trava.
5. Reabrir corretamente se falta for removida antes do commit.

## Critérios de aceite

- Trava ocorre no ponto correto.
- Campos desabilitados não entram como novos dados.
- Estado visual e predicado concordam.

## Não alterar

RPC.
