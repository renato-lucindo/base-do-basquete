---
id: TSK-134
tipo: dados-frontend
dependencias: [TSK-106, TSK-107, TSK-132]
risco: medio
---

# Sugerir última camisa do jogador

## Objetivo

Preencher inicialmente a camisa mais recente, permitindo edição.

## Escopo permitido

Consulta/transformação de sugestão e teste.

## Passos

1. Buscar último uso confirmado na edição/equipe conforme contrato.
2. Preservar texto.
3. Diferenciar ausência de histórico.
4. Atualizar sugestão ao trocar jogador.
5. Não sobrescrever edição manual posterior.

## Critérios de aceite

- `"00"` é preservado.
- Sugestão não vira regra obrigatória.
- Contexto incorreto não influencia.

## Não alterar

Camisa mais usada do perfil.
