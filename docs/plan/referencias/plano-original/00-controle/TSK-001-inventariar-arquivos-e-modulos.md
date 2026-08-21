---
id: TSK-001
tipo: auditoria
dependencias: [TSK-000]
risco: baixo
---

# Inventariar arquivos e módulos afetados

## Objetivo

Criar um mapa real de rotas, componentes, bibliotecas, migrations, RPCs e testes envolvidos nas funções planejadas.

## Escopo permitido

Somente leitura. Priorizar `src/routes`, `src/components/admin`, `src/lib`, `src/integrations/supabase`, `supabase/migrations`, `supabase/tests`, `tests` e `.github/workflows`.

## Passos

1. Listar arquivos por área.
2. Associar cada requisito a arquivos existentes.
3. Marcar componentes compartilhados por mais de uma frente.
4. Identificar arquivos centrais de alto risco, como `src/lib/queries.ts`.
5. Registrar arquivos ausentes que serão candidatos de criação.

## Critérios de aceite

- Cada frente do `README.md` possui caminhos candidatos.
- Arquivos compartilhados têm responsáveis e ordem de edição.
- Nenhum caminho foi inventado sem confirmação no repositório.

## Não alterar

Qualquer arquivo de aplicação ou teste.
