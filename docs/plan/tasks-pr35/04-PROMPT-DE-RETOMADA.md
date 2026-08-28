# Prompt para iniciar uma task separada

Copiar o bloco abaixo, substituindo apenas o ID:

```text
Execute exclusivamente a task <ID> de docs/plan/tasks-pr35/README.md.

Antes de editar, leia AGENTS.md, HANDOFF.md, o protocolo global do plano de tasks e as seções normativas citadas no cartão. Reconcilie git status, os dez últimos commits, a PR #35 e os checks remotos. Preserve todo trabalho existente e public/__admin-preview.html.

Não implemente nenhuma feature pertencente a outro cartão. Se surgir dependência nova, registre-a no HANDOFF.md e pare na menor unidade segura. Use migration nova; não altere migration já enviada/aplicada. Faça staging somente por caminhos exatos. Execute o gate indicado, atualize o HANDOFF.md e deixe o próximo ID, primeiro arquivo e validação esperada. Mantenha a PR draft; não faça merge nem produção.
```
