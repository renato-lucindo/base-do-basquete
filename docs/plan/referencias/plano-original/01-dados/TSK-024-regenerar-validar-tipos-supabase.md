---
id: TSK-024
tipo: integracao
dependencias: [TSK-010, TSK-011, TSK-013, TSK-014, TSK-015, TSK-016, TSK-017, TSK-018, TSK-019, TSK-020, TSK-021, TSK-023]
risco: medio
---

# Regenerar e validar tipos Supabase

## Objetivo

Sincronizar TypeScript com o schema somente depois de todas as migrations aprovadas desta frente.

## Escopo permitido

Arquivo de tipos gerados e ajustes mínimos diretamente causados por mudança de tipo.

## Passos

1. Gerar tipos usando o procedimento oficial do projeto.
2. Comparar o diff e confirmar que só reflete migrations aprovadas.
3. Corrigir erros de compilação um módulo por vez.
4. Executar TypeScript, testes SQL e testes unitários afetados.
5. Rejeitar edição manual de tipos gerados.

## Critérios de aceite

- Tipos correspondem ao banco.
- Build não usa casts para esconder incompatibilidades.
- Diff não contém mudança de schema inesperada.

## Não alterar

Dependências, estilos ou regras de negócio.
