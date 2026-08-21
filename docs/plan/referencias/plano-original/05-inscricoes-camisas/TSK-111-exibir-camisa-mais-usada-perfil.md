---
id: TSK-111
tipo: frontend
dependencias: [TSK-110]
risco: baixo
---

# Exibir camisa mais usada no perfil

## Objetivo

Mostrar uma única camisa de reconhecimento, preservando zeros à esquerda.

## Escopo permitido

Componente do perfil e teste de renderização.

## Passos

1. Consumir o campo pronto da consulta.
2. Renderizar como texto.
3. Definir estado sem histórico.
4. Opcionalmente exibir contagem apenas se aprovada no contrato.
5. Testar `"00"` e ausência.

## Critérios de aceite

- Perfil mostra apenas o número vencedor.
- `"00"` aparece literalmente.
- Não há cálculo no componente.

## Não alterar

Consulta, honras ou layout global.
