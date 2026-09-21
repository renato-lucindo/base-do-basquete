# Modelo de boxscore do site

## Escopo

O importador aceita o PDF representado por `referencias/modelos-boxscore/Boxscore-site.pdf` como um contrato explícito, identificado por `BASKETBALL_SITE` e `basketball-site-v1`. Ele não é um parser genérico e não habilita OCR.

## Dados disponíveis

- equipes, placar final, data, horário e ginásio;
- camisa, nome abreviado, minutos e estatísticas individuais presentes nas tabelas;
- tabela de uma equipe dividida entre páginas.

O documento não informa número do jogo, competição, duração, parciais por período, plus/minus, faltas recebidas nem estatísticas coletivas. Esses valores permanecem ausentes no payload e nas projeções públicas. Para reutilizar a ingestão transacional existente, o placar e as estatísticas individuais totais são persistidos em um bucket técnico explicitamente marcado como `game_total`; ele não é apresentado como período real e não concede autoridade ao domínio `period_scores`. O campo `plus_minus_available` preserva a diferença entre zero e dado indisponível.

## Identificação de atletas

Um nome abreviado só é pré-selecionado quando existe exatamente um cadastro que satisfaça simultaneamente:

1. equipe normalizada igual à equipe de origem;
2. número de camisa igual;
3. inicial e sobrenomes compatíveis, permitindo o último sobrenome truncado pelo PDF.

Se nenhum atleta ou mais de um atleta atender ao conjunto, a importação permanece para revisão humana. Similaridade isolada nunca autoriza associação automática.

## Regressão obrigatória

- manter os dois PDFs FIBA/Genius Sports existentes como fixtures;
- testar o PDF de duas páginas deste contrato;
- testar identificação única, ambiguidade e divergência de equipe;
- não ativar `period_scores`, `team_advanced` ou `game_advanced` para este formato.
