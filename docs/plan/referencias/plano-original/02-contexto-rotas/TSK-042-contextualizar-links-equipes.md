---
id: TSK-042
tipo: frontend
dependencias: [TSK-038]
risco: medio
---

# Contextualizar links de equipes

## Objetivo

Preservar a edição ao navegar de classificação, jogos ou elenco para uma equipe.

## Escopo permitido

Links públicos de equipe e testes.

## Passos

1. Inventariar todos os pontos clicáveis.
2. Trocar somente os links dentro de rotas contextuais.
3. Validar que a equipe está inscrita no contexto.
4. Tratar entidade existente globalmente, mas ausente na edição, como not-found contextual.
5. Testar duas edições da mesma equipe.

## Critérios de aceite

- Elenco e conquistas exibidos pertencem à edição correta.
- Não há consulta global acidental.
- Rotas legadas continuam conforme `TSK-044`.

## Não alterar

Cadastro global da equipe.
