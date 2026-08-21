---
id: TSK-094
tipo: frontend
dependencias: [TSK-091, TSK-092, TSK-093]
risco: medio
---

# Revisar associações antes da importação

## Objetivo

Exigir decisão explícita para cada atleta não resolvido exatamente.

## Escopo permitido

Trecho de `BoxscoreImport.tsx` responsável pela revisão e testes.

## Passos

1. Mostrar estado exato, sugestão, ambíguo ou sem candidato.
2. Permitir selecionar existente ou criar conforme permissão.
3. Exibir equipe/edição suficiente para evitar homônimos.
4. Bloquear confirmação enquanto houver pendência.
5. Revalidar ao trocar competição.

## Critérios de aceite

- Similaridade nunca confirma sozinha.
- Todas as linhas têm resolução rastreável.
- Troca de contexto descarta resoluções incompatíveis.

## Não alterar

Parser ou RPC.
