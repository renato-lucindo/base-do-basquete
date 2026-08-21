---
id: TSK-095
tipo: dados
dependencias: [TSK-021, TSK-083, TSK-088, TSK-094]
risco: alto
---

# Persistir rascunho e auditoria da importação

## Objetivo

Registrar arquivo, hash, versão do parser, payload, resoluções, validação, autor e status.

## Escopo permitido

Tabela de importações/RPC e testes.

## Passos

1. Definir estados permitidos e transições.
2. Registrar somente dados necessários.
3. Impedir alteração de importação confirmada sem fluxo explícito.
4. Guardar erro seguro e detalhe interno separado.
5. Vincular `game_id` no sucesso.

## Critérios de aceite

- É possível auditar como cada atleta foi resolvido.
- Status não afirma sucesso antes do commit.
- Falha não deixa jogo parcial.

## Não alterar

Logs gerais da aplicação.
