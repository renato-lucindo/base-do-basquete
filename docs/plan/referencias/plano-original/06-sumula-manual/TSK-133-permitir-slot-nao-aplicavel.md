---
id: TSK-133
tipo: frontend
dependencias: [TSK-131, TSK-132]
risco: baixo
---

# Permitir slot N/A

## Objetivo

Representar ausência sem criar jogador ou registro vazio no banco.

## Escopo permitido

Estado do slot, opção visual e serialização.

## Passos

1. Definir estado `empty`.
2. Limpar camisa e estatísticas do slot ao confirmar N/A.
3. Pedir confirmação se houver dados preenchidos.
4. Omitir o slot do payload persistido.
5. Testar equipe com menos de 12 atletas.

## Critérios de aceite

- N/A não gera linha de jogador.
- Dados antigos não ficam escondidos no payload.
- Usuário pode reativar o slot.

## Não alterar

RPC ou schema.
