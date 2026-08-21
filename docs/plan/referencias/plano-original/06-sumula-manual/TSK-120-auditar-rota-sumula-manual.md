---
id: TSK-120
tipo: roteamento-admin
dependencias: [TSK-044]
risco: medio
---

# Auditar rota da súmula manual

## Objetivo

Garantir rota administrativa própria, estável e fora do escopo público dinâmico.

## Escopo permitido

Rota existente como `src/routes/_authenticated/admin.scoresheets.new.tsx` e teste de rota.

## Passos

1. Confirmar caminho e composição autenticada.
2. Validar carregamento direto e refresh.
3. Impedir interpretação como contexto público.
4. Definir origem e retorno ao hub.
5. Testar not-found de subrota inválida.

## Critérios de aceite

- Rota abre isoladamente.
- `/admin` permanece funcional.
- Nenhum parâmetro público é exigido antes do hub.

## Não alterar

Editor ou persistência.
