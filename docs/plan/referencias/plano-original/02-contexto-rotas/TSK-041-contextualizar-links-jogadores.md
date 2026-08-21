---
id: TSK-041
tipo: frontend
dependencias: [TSK-038]
risco: medio
---

# Contextualizar links de jogadores

## Objetivo

Garantir que todo clique em atleta preserve a edição ativa.

## Escopo permitido

Listas/tabelas públicas de jogador e seus testes de link.

## Passos

1. Localizar todos os links para perfil.
2. Separar perfil global de visão contextual conforme contrato.
3. Usar builder contextual quando a origem estiver dentro de competição.
4. Testar o mesmo jogador em duas categorias.
5. Evitar fallback silencioso para dados globais.

## Critérios de aceite

- Link aberto em nova aba mantém o contexto.
- Estatísticas exibidas correspondem à URL.
- Nenhuma rota administrativa é afetada.

## Não alterar

Consulta de perfil; somente links.
