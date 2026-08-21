---
id: TSK-036
tipo: frontend
dependencias: [TSK-030, TSK-031]
risco: baixo
---

# Persistir último contexto válido

## Objetivo

Salvar somente uma referência de navegação recente, sem transformar `localStorage` em fonte da verdade.

## Escopo permitido

Utilitário de preferência contextual e testes.

## Passos

1. Definir chave versionada.
2. Salvar apenas após resolução válida.
3. Validar formato ao ler.
4. Ignorar JSON corrompido ou versão desconhecida.
5. Não salvar dados de estatísticas ou permissões.

## Critérios de aceite

- Preferência corrompida não quebra a aplicação.
- URL e banco continuam autoritativos.
- Testes simulam storage ausente e inválido.

## Não alterar

Rota raiz ou seletor visual.
