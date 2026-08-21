---
id: TSK-037
tipo: frontend
dependencias: [TSK-030, TSK-031, TSK-036]
risco: medio
---

# Implementar seletor Ano → Competição → Categoria

## Objetivo

Permitir troca de contexto atualizando a URL, nunca apenas estado local.

## Escopo permitido

Componente do seletor, consulta de opções e testes de interação.

## Passos

1. Derivar seleção atual dos parâmetros.
2. Filtrar opções dependentes sem combinações inválidas.
3. Ao concluir a seleção, navegar para a URL contextual.
4. Preservar o recurso atual quando disponível no novo contexto; usar fallback definido caso contrário.
5. Tratar carregamento e lista vazia.

## Critérios de aceite

- Recarregar mantém a seleção.
- Botões voltar/avançar funcionam.
- Nenhum estado fica divergente da URL.

## Não alterar

Consultas de conteúdo ou `/admin`.
