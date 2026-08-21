---
id: TSK-081
tipo: seguranca
dependencias: [TSK-080]
risco: alto
---

# Validar papel administrativo no upload

## Objetivo

Recusar importação de usuário ausente, expirado ou sem permissão.

## Escopo permitido

Limite definido em `TSK-080`, política/RPC relacionada e testes negativos.

## Passos

1. Validar sessão no servidor/RPC.
2. Resolver papel por fonte autoritativa.
3. Não aceitar role enviada pelo cliente.
4. Retornar erro padronizado.
5. Testar anônimo, usuário comum, admin e sessão expirada.

## Critérios de aceite

- Apenas admin autorizado confirma importação.
- Acesso direto ao banco/RPC também é bloqueado.
- Logs não expõem token.

## Não alterar

Rate limit ou interface.
