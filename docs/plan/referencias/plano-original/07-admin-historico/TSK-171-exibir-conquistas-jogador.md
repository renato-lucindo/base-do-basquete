---
id: TSK-171
tipo: frontend
dependencias: [TSK-041, TSK-170]
risco: baixo
---

# Exibir conquistas no perfil do jogador

## Objetivo

Mostrar histórico derivado de elencos separadamente de outras honras.

## Escopo permitido

Componente do perfil e testes.

## Passos

1. Manter honras existentes em seção própria.
2. Exibir competição, equipe, ano, categoria e colocação.
3. Linkar para contexto correto.
4. Tratar ausência.
5. Não duplicar conquistas idênticas.

## Critérios de aceite

- Histórico não muda com equipe atual.
- Dados derivados e manuais não se confundem.
- Links permanecem contextuais.

## Não alterar

Consulta de camisa.
