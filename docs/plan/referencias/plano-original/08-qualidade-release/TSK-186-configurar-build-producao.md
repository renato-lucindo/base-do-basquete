---
id: TSK-186
tipo: ci
dependencias: [TSK-180, TSK-181]
risco: medio
---

# Configurar build de produção

## Objetivo

Executar o build real do TanStack Start/Vite em PR e push.

## Escopo permitido

Workflow e variáveis não secretas/fixtures necessárias.

## Passos

1. Executar `npm run build`.
2. Definir variáveis de build seguras.
3. Não usar segredo de produção em PR externo.
4. Falhar em import/rota quebrada.
5. Registrar tamanho/avisos relevantes.

## Critérios de aceite

- Build é igual ao caminho de implantação.
- Nenhuma chave privilegiada entra no bundle.
- Artefato é produzido com sucesso.

## Não alterar

Configuração do runtime de produção.
