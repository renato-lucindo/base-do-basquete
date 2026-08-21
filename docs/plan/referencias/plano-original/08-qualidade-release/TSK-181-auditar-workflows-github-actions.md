---
id: TSK-181
tipo: ci
dependencias: [TSK-180]
risco: baixo
---

# Auditar workflows do GitHub Actions

## Objetivo

Localizar a configuração atual antes de criar `main.yml` duplicado.

## Escopo permitido

Somente leitura de `.github/workflows`.

## Passos

1. Listar arquivos e gatilhos.
2. Mapear jobs para lint, testes e build.
3. Identificar permissões, versões e cache de dependências.
4. Comparar com o requisito de push/PR na `main`.
5. Registrar lacunas.

## Critérios de aceite

- Workflow existente é reutilizado quando adequado.
- Nenhum job duplicado é planejado sem justificativa.
- Nomes e caminhos reais estão documentados.

## Não alterar

Workflow nesta tarefa.
