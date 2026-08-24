# 0003 — Cache condicionado por medição

## Estado

Aceita no WP-11.

## Contexto

A primeira temporada usa Cloudflare Workers em URLs temporárias `workers.dev` e Supabase na região `sa-east-1`. As páginas públicas consultam views `security_invoker`; as rotas administrativas sempre são privadas e não podem receber cache compartilhado.

Antes de adicionar estado distribuído, foram definidos os seguintes limites para páginas públicas, medidos do mesmo host autorizado:

- p50 menor ou igual a 1.000 ms;
- p95 menor ou igual a 1.500 ms;
- agregação SQL avançada em volume representativo menor ou igual a 250 ms.

O volume de planejamento da primeira temporada é 250 jogos, 240 atletas, 6.000 escalações e 24.000 linhas de estatística por período em uma edição.

## Decisão

Não adicionar cache no WP-11 enquanto as três metas forem atendidas. Manter o banco como fonte imediata das respostas evita invalidação incorreta após súmula manual ou importação e reduz complexidade operacional na primeira temporada.

Se uma medição futura ultrapassar a meta de forma sustentada, o primeiro candidato será um adaptador read-through apenas para DTOs públicos, com chave versionada por `competitionId`, capacidade e modo; TTL curto; falha aberta controlada; e invalidação contextual somente após commit. Dados autenticados, cookies, segredos e payloads pessoais ficam proibidos no cache.

## Consequências

- Não há binding, custo ou estado adicional no Cloudflare.
- Respostas continuam consistentes imediatamente após commits.
- O script `npm run benchmark:public -- <preview-url> [amostras]` torna o benchmark HTTP repetível e bloqueia produção por padrão.
- A decisão deve ser reavaliada quando houver domínio próprio, mudança relevante de volume ou p95 sustentado acima da meta.
