---
id: TSK-093
tipo: dados-frontend
dependencias: [TSK-014, TSK-015, TSK-092]
risco: alto
---

# Filtrar candidatos pelo elenco da edição

## Objetivo

Priorizar/limitar associações aos atletas inscritos pela equipe no `competition_id` escolhido.

## Escopo permitido

Consulta/transformação de candidatos e testes.

## Passos

1. Resolver registro da equipe na competição.
2. Carregar `roster_entries` dessa inscrição.
3. Excluir atleta inscrito por adversário na mesma edição.
4. Definir tratamento de atleta ainda não inscrito.
5. Testar jogador multi-edição.

## Critérios de aceite

- Candidato de outra equipe na mesma edição não é aceito.
- Elenco de outro ano não interfere.
- Ausência de elenco exige ação explícita.

## Não alterar

Constraint ou gravação do elenco.
