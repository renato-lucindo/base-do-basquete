# Etapa 10 — Gate e fechamento da PR

## Objetivo

Estabilizar a implementação, executar o gate consolidado e obter pareceres válidos sobre o mesmo `HEAD_COMMIT`.

## Atividades

- Executar uma única vez o gate completo após estabilização:
  - lint e formatação em modo de verificação;
  - typecheck;
  - testes afetados;
  - pgTAP/RLS;
  - build;
  - verificação de segredos;
  - QA de teclado e acessibilidade.
- Preparar `REVIEW_PACKET` no mesmo `HEAD_COMMIT`.
- Solicitar `database-security-reviewer`, `statistics-domain-reviewer`, `accessibility-ui-reviewer` e `qa-reviewer`.
- Incluir `boxscore-domain-reviewer` somente se a implementação tocar contratos ou persistência de boxscore.
- Corrigir achados em commits próprios.
- Renovar os pareceres afetados depois de qualquer mudança material.

## Checkpoint

HEAD fixo, gates verdes e todos os pareceres obrigatórios válidos para o mesmo commit.

## Encerramento

Atualizar `HANDOFF.md` com estado real do Git, testes, riscos residuais e `PROXIMO_PASSO_EXATO`. Merge, migration compartilhada e produção seguem as autorizações e gates vigentes do repositório.
