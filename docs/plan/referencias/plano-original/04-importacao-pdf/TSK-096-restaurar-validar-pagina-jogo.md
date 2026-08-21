---
id: TSK-096
tipo: frontend
dependencias: [TSK-043, TSK-083, TSK-095]
risco: medio
---

# Restaurar e validar a página do jogo

## Objetivo

Exibir dados confirmados do PDF e da súmula manual no fluxo contextual.

## Escopo permitido

Rota/componente de detalhe e consulta, sem mudar persistência.

## Passos

1. Auditar `src/routes/games.$gameId.tsx` e rota contextual.
2. Exibir cabeçalho, placar, equipes, atletas e períodos disponíveis.
3. Não mostrar rascunho como resultado oficial.
4. Tratar jogo ausente e contexto divergente.
5. Navegar para o detalhe após importação.

## Critérios de aceite

- Dados da fixture aparecem uma vez e no time correto.
- Recarregamento direto funciona.
- Categoria simples não solicita detalhe avançado desnecessário.

## Não alterar

Importador ou agregações.
