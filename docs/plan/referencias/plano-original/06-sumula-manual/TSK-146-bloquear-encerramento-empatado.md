---
id: TSK-146
tipo: dominio
dependencias: [TSK-140, TSK-145]
risco: alto
---

# Bloquear encerramento com empate

## Objetivo

Exigir OT quando totais estiverem iguais ao tentar confirmar a partida.

## Escopo permitido

Validador de encerramento no cliente e backend, mais testes.

## Passos

1. Calcular placar autoritativo.
2. Permitir rascunho empatado.
3. Bloquear somente a confirmação/encerramento.
4. Sugerir criação de OT.
5. Revalidar no RPC.

## Critérios de aceite

- Jogo empatado não vira final.
- Rascunho pode ser salvo conforme contrato.
- Backend recusa bypass.

## Não alterar

Fórmula de pontos.
