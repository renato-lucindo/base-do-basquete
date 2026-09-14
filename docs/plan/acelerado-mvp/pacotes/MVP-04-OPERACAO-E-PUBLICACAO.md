# MVP-04 — Agendamento, progressão básica e publicação

- **Estado atual:** `DOING`; MVP-03 concluído, usa ingestão de `MVP-01`
- **Incorpora:** `07G`, parte básica de `07H`, `08A`, `08B`, `08C`, `08D`
- **Meta:** 2–3 janelas.

## Entregar

- Agendar/preparar partida somente dentro de confronto, com ordem, data/hora, local, mando e participantes derivados.
- Resolver confronto eliminatório uma vez a partir do `official_result` ativo principal e propagar vencedor/perdedor.
- Separar definitivamente estado esportivo de visibilidade.
- Resumo server-side e regras temporais em `America/Sao_Paulo`; a data habilita ação, nunca publica sozinha.
- Revisão/publicação AAL2 explícita e versionada.
- Área pública agrupada pela estrutura esportiva, com busca, canonical, cache e URLs diretas obedecendo à mesma visibilidade.

## Corte consciente

Progressão por fallback, fechamento automático de grupos, W.O. e emendas ficam em `POST-01`/`POST-03`. Grupo único do MVP publica tabela e jogos, mas não alimenta uma fase posterior automaticamente.

## Gate

Scheduled sem placar não aparece como 0×0; draft/review não progride; jogo privado não vaza em nenhuma superfície; publicação é idempotente; público vê apenas a última versão confirmada; smokes público/privado e fluxo eliminatório ponta a ponta passam.
