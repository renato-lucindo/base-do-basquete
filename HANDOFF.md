undefined

## 20. Correcoes dos achados estatisticos P1/P2 — 10/10/2026

O maintainer preparou uma correcao focal da PR #72 no codigo de autoridade estatistica. A view `game_player_statistics` conserva NULL nas tentativas de arremesso quando o jogador consta no elenco mas nao tem registros avancados, mesmo sob autoridade FIBA; DNP explicitamente declarado nao representa participacao. A view `game_boxscore_player_statistics` passa a exigir linha de estatisticas para expor cobertura avancada, protegendo tambem o agregado de competicao e o perfil. O consumidor `public-sports.server.ts` verifica tentativas nulas por jogador ativo antes de declarar percentuais e eficiencia completos.

Regressoes propostas: SQL no fixture Basketball Site com remocao temporaria de stats sob SAVEPOINT, verificando jogo/competicao/perfil e DNP; Vitest para roster FIBA parcial; SQL com publicacao manual inicial, revisao e comparacao do snapshot congelado + invalidacao do fingerprint, e teste de snapshot para impedir leitura de autoridade ainda nao republicada. O modelo de publicacao editorial continua versionado: o publico ve o snapshot confirmado anterior ate uma nova publicacao, e a leitura do jogo alterado exige fingerprint valido.

Nenhuma migration foi aplicada no Supabase compartilhado e nenhum merge foi realizado. EVIDENCIA_PENDENTE: executar Stage 4 Validation e CI em banco descartavel para o novo HEAD e obter novas revisoes independentes estatisticas e de seguranca conforme contrato. O BLOCK_RELEASE permanece ate parecer novo.

PROXIMO_PASSO_EXATO: RESPONSAVEL=project-maintainer; ARQUIVO_OU_SERVICO=PR #72/Actions e .agents/statistics-domain-reviewer.md; ACAO=verificar pgTAP completo e focal, CI, preview e CodeQL no commit corrigido; ajustar qualquer falha, solicitar pareceres independentes renovados e registrar resultados na PR; CRITERIO_DE_CONCLUSAO=regressoes verdes no SHA corrigido e parecer estatistico capaz de levantar o BLOCK_RELEASE, mantendo draft e Supabase compartilhado intactos.
