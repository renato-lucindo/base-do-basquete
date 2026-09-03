# Revisão do plano para velocidade

## Problema corrigido

O plano anterior tratava cada um dos 50 cartões como uma unidade operacional completa. Mesmo cartões pequenos exigiam retomada, leitura, implementação, testes amplos, commit, push, CI, preview, smoke e HANDOFF. Com 39 cartões ainda abertos, o custo de coordenação passou a dominar o tempo de desenvolvimento.

## Nova estratégia

- Os 50 cartões continuam rastreados, mas são requisitos internos de 9 pacotes verticais.
- O caminho crítico do MVP contém somente 5 pacotes e termina em uma release candidata utilizável.
- Testes focais rodam durante o pacote; CI completo, preview e smoke rodam uma vez no seu fechamento.
- Commits intermediários continuam pequenos e reversíveis, sem transformar cada commit em um gate remoto.
- Migrações próximas e compatíveis são desenhadas no mesmo pacote, mantendo arquivos aditivos e imutáveis depois do push.
- O trabalho não espera por exceções pós-MVP quando existe um comportamento seguro de revisão ou bloqueio.

## O que entra primeiro

1. jogo ligado à estrutura e ingestão segura;
2. jogadores e estatísticas públicas essenciais;
3. criação administrativa por dois presets previsíveis;
4. agenda, progressão básica e publicação explícita;
5. QA e release candidata do fluxo ponta a ponta.

## O que sai do caminho crítico, sem ser descartado

- fallback e suplemento entre fontes;
- resolução avançada de conflitos;
- projeções raras do boxscore;
- clonagem e editor estrutural genérico;
- remoção e retirada de equipes;
- encerramento formal de grupos, W.O. e emendas;
- enforcement final dependente de filas humanas.

Esses itens estão mapeados em `POST-01` a `POST-04`, com os cartões originais preservados em `../tasks-pr35/`.

## Ganho esperado

- Antes: até 39 ciclos remotos restantes.
- Agora: 5 ciclos verticais para chegar ao MVP e 4 para concluir o restante.
- Meta operacional: 6 a 9 janelas, ou 3 a 5 dias corridos, para uma release candidata do MVP.
- Meta do escopo completo: mais 7 a 11 janelas, ou 4 a 7 dias adicionais.

## Limites que não foram negociados

MFA/AAL2, autorização server-side, RLS, auditoria, privacidade de PDFs, migrations aditivas, idempotência, validação no backend, fixtures FIBA e proibição de WIP em produção permanecem gates obrigatórios.
