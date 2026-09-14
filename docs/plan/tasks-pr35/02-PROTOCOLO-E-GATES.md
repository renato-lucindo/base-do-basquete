# Protocolo de início, encerramento e gates

## Início obrigatório

1. Ler `AGENTS.md`, `HANDOFF.md`, este documento e a seção normativa citada no cartão da task.
2. Executar `git status --short --branch` e `git log --oneline -10`.
3. Confirmar PR, branch, head e checks remotos.
4. Confirmar que as dependências estão `DONE`.
5. Mudar apenas a task escolhida para `DOING` no handoff; não editar cartões de tasks futuras sem necessidade.
6. Registrar a allowlist inicial de arquivos. Expansão exige motivo no handoff.

## Encerramento obrigatório

1. Terminar a menor unidade segura e executar o gate indicado.
2. Executar `git diff --check` e `git status --short`.
3. Atualizar `HANDOFF.md` com fatos reais, inclusive arquivos não rastreados.
4. Registrar commit, migrations, contagens, checks, preview, riscos e próximo cartão.
5. Fazer staging por caminhos exatos; nunca usar `git add .`, `-A` ou `--all`.
6. Manter a PR draft; não fazer merge nem produção.

## Bloco de handoff mínimo

```text
Task atual e estado:
Branch / head / PR:
Objetivo concluído:
Arquivos e migrations alterados:
Decisões e invariantes:
Testes locais reais:
CI / banco / preview / CodeQL:
Estado de filas e reconciliação:
Mudanças não commitadas e arquivos preservados:
Riscos ou bloqueios:
Próxima task: ID + primeiro arquivo + validação esperada
```

## Gates proporcionais

| Gate       | Quando usar          | Mínimo obrigatório                                                           |
| ---------- | -------------------- | ---------------------------------------------------------------------------- |
| `G-DOC`    | documentação         | links/IDs conferidos, `git diff --check`, status e handoff                   |
| `G-DOMAIN` | domínio/contratos    | Biome nos caminhos, testes afetados, typecheck, build                        |
| `G-DB`     | schema/RPC/RLS       | migration nova, pgTAP positivo/negativo, tipos, CI desde zero, reconciliação |
| `G-UI`     | rota/componente      | `G-DOMAIN`, testes de componente, preview, 390/768/desktop e teclado         |
| `G-FLOW`   | fluxo vertical       | `G-DB` + `G-UI`, smoke autenticado AAL2, idempotência e auditoria            |
| `G-FULL`   | checkpoint de pacote | `npm run check`, banco desde zero, preview/smoke, CodeQL e handoff           |

O gate completo não substitui asserções específicas. Uma task de banco só termina quando os testes provam RLS, concorrência e negações relevantes.
