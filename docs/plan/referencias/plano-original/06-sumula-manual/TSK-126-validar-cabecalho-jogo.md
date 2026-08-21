---
id: TSK-126
tipo: dominio-frontend
dependencias: [TSK-124]
risco: medio
---

# Validar cabeçalho da partida

## Objetivo

Validar competição, data, hora, local, mandante e visitante antes de montar elencos.

## Escopo permitido

Schema/formulário do cabeçalho e testes.

## Passos

1. Definir campos obrigatórios.
2. Validar data/hora sem depender do timezone do navegador de forma ambígua.
3. Validar equipes distintas e inscritas.
4. Bloquear avanço com erro por campo.
5. Preservar dados ao corrigir um campo.

## Critérios de aceite

- Cabeçalho inválido não inicia gravação.
- Datas têm formato/zoneamento documentado.
- Erros são acessíveis.

## Não alterar

Persistência ou grade de estatísticas.
