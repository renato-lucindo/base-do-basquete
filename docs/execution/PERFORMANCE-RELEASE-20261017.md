**A repetição representativa atende ao gate de desempenho.** A falha inicial permanece registrada; sua causa é inconclusiva.

Limites preservados: **p50 ≤ 1.000 ms; p95 ≤ 1.500 ms**.

| Rota / execução | Amostras | p50 ms | p95 ms | Máximo ms | Média ms | Gate |
|---|---:|---:|---:|---:|---:|---|
| Jogadores — inicial | 10 | 705,3 | 775,7 | 775,7 | 715,1 | PASS |
| FIBA 63 — inicial | 10 | 798,2 | **2.375,6** | 2.375,6 | 947,7 | **FAIL** |
| Jogadores — repetição | 30 | 587,2 | 670,6 | 688,4 | 589,0 | PASS |
| FIBA 63 — repetição | 30 | 553,4 | 825,2 | 861,1 | 575,8 | PASS |

```text
STATUS: INCONCLUSIVE
PARECER: APPROVE_WITH_NON_BLOCKING_NOTES — somente desempenho
WORK_UNIT: INTEGRATE-86-87-77-ROLLOUT
HEAD_COMMIT: 862288a6ac2f09a0801b33a0a32c4c6c7f58b1d6
REVIEWED_AT: 2026-10-17T04:26:15Z
BASELINE: produção, 2026-10-17T02:31:58.647Z; 10 amostras/rota
CANDIDATE: mesma origem/rotas, 2026-10-17T04:25:58.836Z; 30 amostras/rota
HYPOTHESES_TESTED: repetibilidade do pico de cauda; validade HTTP;
  redirects rejeitados pelo script; comparação dos tamanhos das respostas
ROOT_CAUSE: não determinada; pico inicial não reproduzido nesta repetição
EVIDENCE: 3 aquecimentos/rota em ambas as execuções; mesmos limites;
  respostas 2xx e não vazias; payloads coincidentes: 16.361 e 37.692 bytes
RECOMMENDED_CHANGE: nenhuma correção sustentada pela evidência disponível
RESIDUAL_RISKS: medição limitada a duas rotas e uma janela;
  cache, rede, SQL e Worker não foram isolados causalmente
GIT_STATUS_BEFORE: limpo
GIT_STATUS_AFTER: M HANDOFF.md — delta documental conhecido do parent;
  HEAD preservado; nenhuma alteração deste investigador em arquivos versionados
```

O [relatório inicial](<production-benchmarks-20261017.json>) foi preservado, com SHA256 conferido antes/depois. A única repetição autorizada está em [production-benchmark-30.json](<production-benchmarks-20261017.json>).

```text
SKILL_RESULT:
SKILL: investigating-base-performance
STATUS: PASS
SCOPE: repetição controlada do gate público de produção
HEAD_COMMIT: 862288a6ac2f09a0801b33a0a32c4c6c7f58b1d6
EVIDENCE: ambos os JSONs preservados
GATES_RUN: benchmark padrão, BENCHMARK_ALLOW_PRODUCTION=true;
  30 amostras + 3 aquecimentos por rota
GATES_OMITTED: suítes completas e diagnósticos adicionais,
  dispensados pelo escopo após repetição aprovada
FINDINGS: falha inicial real; pico não reproduzido; repetição PASS
RESIDUAL_RISKS: causa inconclusiva
NEXT_ACTION: parent registrar ambos os resultados na evidência de release

PROXIMO_PASSO_EXATO:
RESPONSAVEL: project-maintainer
ARQUIVO_OU_SERVICO: HANDOFF.md e evidência documental de release
ACAO: incorporar este parecer e ambos os resultados, preservando a falha inicial
CRITERIO_DE_CONCLUSAO: gate representativo PASS registrado com limites
  originais e causa do pico explicitamente inconclusiva
```
