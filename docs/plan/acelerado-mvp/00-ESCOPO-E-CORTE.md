# Escopo e corte do MVP

## P0 — obrigatório para publicar o MVP

- Preservar todo o histórico e manter compatibilidade durante rollout.
- Estrutura mínima tipada de edição, etapa, rodada, confronto e jogo.
- Dois presets: **grupo único** e **eliminatória simples**. Formato híbrido e editor livre ficam para depois.
- Criação transacional de edição privada com naipe, perfil de dados, período e preset.
- Administração de equipes e elencos pelos fluxos existentes.
- Agendamento de jogos somente em confronto válido.
- Súmula manual e boxscore de contrato versionado confirmados sobre um jogo existente, sem jogo paralelo.
- Autoridade de dados server-side/banco e idempotência.
- Página pública simples de jogadores para edições de súmula.
- Página boxscore existente sem regressão e orientada pela autoridade.
- Publicação AAL2 explícita; nenhum conteúdo privado em URL, busca, API ou cache.
- QA em 390/768/desktop, teclado, anon/AAL1/AAL2, migrations desde zero, secrets e preview.

## P1 — pós-MVP prioritário

- Fallback manual e boxscore suplementar.
- Comparação e decisão administrativa de conflitos por domínio.
- Projeção rara de boxscore em edição de súmula.
- Remover inscrição provisória ou retirar equipe preservando histórico.
- Clonar template ou edição anterior.
- Editor estrutural genérico.
- Encerramento validado de grupos.

## P2 — pós-MVP completo

- W.O., desistência e decisão administrativa sem placar fictício.
- Correções e emendas com ponto de corte.
- Enforcement final de naipe/perfil após zerar filas.
- Reconciliação e QA integral do escopo completo.

## Decisões de velocidade

- Um pacote vertical recebe um único ciclo consolidado de CI/preview, em vez de um ciclo para cada cartão antigo.
- Migrations continuam aditivas e imutáveis depois do push.
- O gate focal roda durante a implementação; o gate completo roda antes do push do pacote.
- Documentação intermediária fica no commit funcional ou no fechamento do pacote, sem commits exclusivos a cada microetapa.
- O MVP usa presets validados. Não construir editor genérico antes de conseguir criar, jogar e publicar uma competição.
- Ausência de recurso pós-MVP deve resultar em bloqueio/estado de revisão claro, nunca em comportamento implícito ou dado inventado.
