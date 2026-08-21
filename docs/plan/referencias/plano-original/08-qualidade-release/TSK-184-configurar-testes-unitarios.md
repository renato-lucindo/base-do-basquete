---
id: TSK-184
tipo: ci
dependencias: [TSK-180, TSK-181]
risco: medio
---

# Configurar testes unitários na CI

## Objetivo

Executar `node:test` conforme o script real e falhar em regressão.

## Escopo permitido

Workflow e configuração mínima de ambiente.

## Passos

1. Executar `npm run test`.
2. Garantir descoberta de todos os arquivos pretendidos.
3. Não usar credenciais de produção.
4. Tornar timezone/locale determinísticos quando necessário.
5. Registrar saída em falha.

## Critérios de aceite

- Teste falho encerra o job.
- Execução é reproduzível localmente.
- Não depende de rede externa.

## Não alterar

Testes para fazê-los passar.
