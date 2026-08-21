---
id: TSK-102
tipo: banco
dependencias: [TSK-014, TSK-015, TSK-100]
risco: alto
---

# Salvar elenco em uma transação

## Objetivo

Aplicar a lista completa de atletas sem inscrições parciais.

## Escopo permitido

RPC/serviço de elenco e testes SQL.

## Passos

1. Receber inscrição e lista de IDs.
2. Validar IDs duplicados e existência dos jogadores.
3. Validar conflito entre equipes na edição.
4. Aplicar inclusão/remoção conforme contrato numa transação.
5. Injetar falha intermediária e provar rollback.

## Critérios de aceite

- Ou todo o elenco é salvo, ou nada muda.
- Concorrência respeita `TSK-015`.
- Resposta identifica conflitos de forma estável.

## Não alterar

Cadastro do jogador ou jogos já confirmados.
