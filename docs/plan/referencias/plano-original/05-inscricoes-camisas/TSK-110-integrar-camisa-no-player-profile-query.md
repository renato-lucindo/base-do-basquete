---
id: TSK-110
tipo: integracao
dependencias: [TSK-109]
risco: medio
---

# Integrar camisa mais usada na consulta do perfil

## Objetivo

Entregar somente o número vencedor e seus metadados ao perfil, sem recalcular na renderização.

## Escopo permitido

`playerProfileQuery`/serviço equivalente e testes.

## Passos

1. Auditar consulta atual que combina `boxscores` e `scoresheet_entries`.
2. Evitar transferência desnecessária de todo o histórico se houver RPC agregada.
3. Incluir número, contagem e regra de desempate aplicada.
4. Tratar perfil sem partidas.
5. Manter honras e demais dados inalterados.

## Critérios de aceite

- Resultado coincide com `TSK-109`.
- Outras seções do perfil não mudam.
- Consulta não mistura jogadores.

## Não alterar

Componente visual.
