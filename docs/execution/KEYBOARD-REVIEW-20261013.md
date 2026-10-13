# Pareceres finais — Súmula por teclado

Unidade `MANUAL-KEYBOARD-MVP`, PR77. Base `27d917a1ce4a404ced091fd3ca660113c215ca92`; commit funcional revisado `d26d7ddccd99eea8e8de41d0af5dd220b9b39cbb`. Revisores independentes read-only sob contrato v3, sem alteração do objeto da revisão. Atualizações posteriores de checkpoint são exclusivamente documentais.

| Domínio | Parecer final | Data da revisão |
| --- | --- | --- |
| Banco/segurança | APPROVE | 13/10/2026 20:14:05 UTC |
| Estatísticas | APPROVE | 13/10/2026 20:13:38 UTC |
| Acessibilidade/interação | APPROVE | 13/10/2026 17:13:36 -03:00 |
| QA, entrega draft + preview | APPROVE_WITH_NON_BLOCKING_NOTES | 13/10/2026 20:25:00 UTC |

## Achados resolvidos

Banco: aliases de SQL/procedural, revisão impedida pelo guard de autoridade, UPDATE que retirava projeção do jogo reservado, formatos JSON incompatíveis com o loader e UUID aceito pelo cast PostgreSQL mas rejeitado pelo Zod. A versão final confere representação UUID exata, mantém invariantes na troca das seis autoridades e rejeita dados malformados sem mudar versão/documento/recibos. Parecer final conferiu a função instalada no banco descartável, regex do Zod, hash da migration e 54 assertivas focais.

Estatística: participação explícita impede contabilizar DNP como aparição; atleta que entrou sem pontos continua no denominador. D direto permanece D nas duas funções de atleta-treinador. Compensadas contam como faltas/GD, sem LL. Parecer independente conferiu as regressões e os agregados públicos; nenhum achado estatístico aberto.

Interação: desfazer/refazer cancela edição removida; troca de equipe preserva identidade da correção; erros de camisa são localizados, associados ao campo e recebem foco. Desmarcar participação com eventos mantém editor/checkbox/foco/histórico e mostra erro acessível. Revisor reproduziu os casos em Chromium e conferiu axe/reflow em 390/720/1440 nos dois temas. Zoom 200% e leitor de tela não foram reproduzidos independentemente; não há declaração de conformidade WCAG geral.

QA: a primeira execução usava sete versões instaladas diferentes do lockfile. A lacuna foi encerrada com `npm ci` em checkout limpo, 22 versões diretas conferidas, zero divergências, 487 Vitest, typecheck/build/scan717 e nove Playwright aprovados. O novo preview `60c2ead2-e452-4421-a79d-273174545d85` usa o build travado e passou nos smokes públicos/segurança. O mantenedor preservou o runtime das outras branches.

## Limites do parecer

Entrega de implementação em draft/preview aprovada. **Merge/release: BLOCKED**, pois GitHub CI/CodeQL não iniciaram por cobrança/limite da conta e falta prova do fluxo autenticado remoto via GoTrue/PostgREST. A migration compartilhada não foi aplicada. O replay nativo usa Auth/Storage de compatibilidade e não substitui esse gate.

Audit de produção reportou zero vulnerabilidades. Seis alertas altos do toolchain dev já estão no lockfile da base; a feature não alterou dependências. Manter o tratamento na unidade de dependências apropriada, sem misturar mudanças na súmula.

Evidências reproduzíveis: `KEYBOARD-SCORESHEET-MVP.md`, `keyboard-native-validation-20261013.json`, `keyboard-locked-validation-20261013.json` e scripts versionados. A evidência SQL composta identifica explicitamente o replay integral anterior e o delta focal final; nenhum resultado nativo é apresentado como Supabase/CI remoto aprovado.

Próximo passo: publicar estes pareceres e o checkpoint, manter draft e completar gates remotos/integração isolada autorizada antes de release.
