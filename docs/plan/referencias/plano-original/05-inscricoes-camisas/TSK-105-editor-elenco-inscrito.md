---
id: TSK-105
tipo: frontend-admin
dependencias: [TSK-102, TSK-103, TSK-104]
risco: alto
---

# Editar elenco inscrito

## Objetivo

Montar a lista completa e enviá-la uma única vez ao serviço transacional.

## Escopo permitido

Editor administrativo de elenco e testes.

## Passos

1. Carregar elenco atual da inscrição.
2. Permitir adicionar/remover localmente.
3. Detectar duplicidade antes do envio.
4. Exibir conflito retornado pelo banco.
5. Recarregar estado autoritativo após sucesso.

## Critérios de aceite

- Falha de rede não exibe salvamento parcial.
- Jogador de outra equipe na edição é identificado.
- Botão salvar evita duplo envio.

## Não alterar

RPC ou cadastro global de atleta.
