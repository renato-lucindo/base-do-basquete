---
id: TSK-148
tipo: frontend-integracao
dependencias: [TSK-103, TSK-127, TSK-147]
risco: alto
---

# Salvar o editor de súmula

## Objetivo

Enviar uma vez, tratar resultado transacional e navegar para o jogo confirmado.

## Escopo permitido

Handler de salvamento e testes de interação.

## Passos

1. Executar validações locais.
2. Bloquear duplo envio.
3. Chamar o RPC com payload serializado.
4. Mapear erros por campo/linha.
5. Após sucesso, invalidar queries e navegar ao jogo.

## Critérios de aceite

- Falha mantém dados editáveis.
- Sucesso usa `game_id` retornado.
- UI nunca anuncia sucesso antes do commit.

## Não alterar

RPC ou cache, além de chamar o gancho definido.
