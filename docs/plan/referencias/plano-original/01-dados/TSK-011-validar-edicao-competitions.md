---
id: TSK-011
tipo: banco
dependencias: [TSK-010]
risco: alto
---

# Validar `competitions` como edição contextual

## Objetivo

Provar que cada linha de `competitions` identifica uma edição por série, ano e categoria.

## Escopo permitido

Tabela `competitions`, migration aditiva e teste SQL correspondente.

## Passos

1. Confirmar `series_id`, `year`, nome/categoria e slugs.
2. Verificar nulidade e FKs.
3. Definir, conforme `TSK-004`, a chave natural da edição.
4. Detectar duplicidades antes de adicionar constraint.
5. Criar constraint somente após relatório de dados incompatíveis.

## Critérios de aceite

- Uma combinação contextual resolve no máximo uma edição.
- Não existe `series_id` órfão.
- Dados duplicados são reportados, não apagados automaticamente.

## Não alterar

Conteúdo histórico nem nomes visíveis sem migração aprovada.
