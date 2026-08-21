---
id: TSK-167
tipo: frontend-admin
dependencias: [TSK-103, TSK-166]
risco: medio
---

# Criar formulário de colocação final

## Objetivo

Permitir confirmar posição, retirada ou desqualificação com validação clara.

## Escopo permitido

Trecho de `ChampionshipManagement.tsx` ou componente extraído e testes.

## Passos

1. Exibir equipes inscritas.
2. Selecionar estado do resultado.
3. Exigir colocação apenas para `placed`.
4. Confirmar ação final.
5. Atualizar consultas após sucesso.

## Critérios de aceite

- Combinação inválida não é enviada.
- Erro do backend é exibido.
- Duplo envio é bloqueado.

## Não alterar

RPC ou tabela pública.
