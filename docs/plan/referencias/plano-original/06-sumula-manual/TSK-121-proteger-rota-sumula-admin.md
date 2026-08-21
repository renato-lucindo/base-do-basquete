---
id: TSK-121
tipo: seguranca
dependencias: [TSK-023, TSK-120]
risco: alto
---

# Proteger a súmula manual por papel

## Objetivo

Exigir sessão e papel administrativo na rota e na escrita autoritativa.

## Escopo permitido

Guard da rota, RPC/política e testes negativos.

## Passos

1. Testar anônimo e usuário comum.
2. Redirecionar/autorização conforme padrão existente.
3. Validar papel novamente no RPC.
4. Não confiar em props do cliente.
5. Testar sessão expirada durante o salvamento.

## Critérios de aceite

- Somente admin grava.
- Usuário sem permissão não recebe dados administrativos desnecessários.
- Bloqueio da UI e do banco são independentes.

## Não alterar

Sistema geral de login.
