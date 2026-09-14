# Regras globais contra mistura e perda de contexto

## Um único writer

- Manter apenas uma task de implementação em `DOING`.
- Não executar duas tasks com escrita simultânea na mesma branch ou banco.
- Agentes auxiliares, quando explicitamente autorizados, podem fazer somente inspeção ou testes independentes; não podem editar arquivos sobrepostos.
- Não começar a próxima task para “aproveitar a sessão”. Primeiro concluir, testar, documentar e versionar a atual.

## Escopo fechado

Cada task define:

- objetivo único;
- dependências obrigatórias;
- caminhos iniciais permitidos;
- itens expressamente fora do escopo;
- entregáveis verificáveis;
- gate proporcional;
- condição objetiva de conclusão.

Se for necessário tocar uma feature de outra task, interromper a implementação, registrar a dependência e ajustar o plano/handoff. Não incorporar a feature silenciosamente.

## Migrations imutáveis após envio

- Cada alteração de schema recebe migration nova, com timestamp posterior.
- Uma migration enviada ao GitHub ou aplicada em qualquer ambiente é imutável.
- Correções usam migration corretiva; nunca reescrever o arquivo já conhecido por outro ambiente.
- Usar rollout `expandir → classificar/backfill → impor`.
- A etapa de imposição só começa com relatório de pendências zerado e evidência registrada.
- Preview não aplica migrations automaticamente ao banco compartilhado. Uma feature que depende de schema novo exige compatibilidade de rollout ou aplicação autorizada no ambiente; não confundir “CI desde zero verde” com “schema do preview atualizado”.

## Privacidade e autoridade

- Nunca inferir naipe ou sexo.
- `sex` não entra em DTO público, busca genérica, URL, log, analytics, auditoria genérica ou rascunho.
- Frontend não é autoridade de elegibilidade, progressão, publicação, limites ou exclusão.
- Toda mutação administrativa aplicável preserva AAL2, CSRF, mesma origem, RLS, idempotência, auditoria e privilégio mínimo.
- Dados ausentes permanecem ausentes; não transformar em zero nem fabricar denominadores.

## Estado de uma task

Estados permitidos:

- `DONE`: evidências e commit remoto conhecidos;
- `READY`: dependências concluídas;
- `BLOCKED`: dependência objetiva ausente;
- `DOING`: única task com escrita atual;
- `REVIEW`: implementação pronta, aguardando somente gate remoto/QA;
- `CONDITIONAL`: só pode iniciar após uma medição ou fila zerada.
