const DEFAULT_SAMPLES = 30;
const DEFAULT_WARMUPS = 3;

function parsePositiveInteger(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 500) {
    throw new Error(`${label} deve ser um inteiro entre 1 e 500.`);
  }
  return parsed;
}

function normalizeBaseUrl(value) {
  if (!value) {
    throw new Error("Informe a URL de preview em BENCHMARK_BASE_URL ou como primeiro argumento.");
  }
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("O benchmark remoto exige HTTPS.");
  }
  if (
    /base-do-basquete-prod/i.test(url.hostname) &&
    process.env.BENCHMARK_ALLOW_PRODUCTION !== "true"
  ) {
    throw new Error("Benchmark de produção bloqueado por padrão.");
  }
  return url.origin;
}

function percentile(sorted, quantile) {
  const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index];
}

async function measureRoute(baseUrl, route, samples, warmups) {
  const url = new URL(route.path, baseUrl);
  const durations = [];
  let responseBytes = 0;

  for (let index = 0; index < warmups + samples; index += 1) {
    const startedAt = performance.now();
    const response = await fetch(url, {
      headers: { "User-Agent": "base-do-basquete-controlled-benchmark/1" },
      redirect: "error",
    });
    const body = await response.arrayBuffer();
    const duration = performance.now() - startedAt;
    if (!response.ok) {
      throw new Error(`${route.name} respondeu HTTP ${response.status}.`);
    }
    if (body.byteLength === 0) {
      throw new Error(`${route.name} respondeu sem corpo.`);
    }
    if (index >= warmups) {
      durations.push(duration);
      responseBytes = body.byteLength;
    }
  }

  durations.sort((left, right) => left - right);
  return {
    name: route.name,
    path: route.path,
    samples,
    responseBytes,
    minMs: Number(durations[0].toFixed(1)),
    p50Ms: Number(percentile(durations, 0.5).toFixed(1)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(1)),
    maxMs: Number(durations.at(-1).toFixed(1)),
    averageMs: Number(
      (durations.reduce((total, duration) => total + duration, 0) / durations.length).toFixed(1),
    ),
  };
}

const baseUrl = normalizeBaseUrl(process.argv[2] ?? process.env.BENCHMARK_BASE_URL);
const samples = parsePositiveInteger(
  process.argv[3] ?? process.env.BENCHMARK_SAMPLES,
  DEFAULT_SAMPLES,
  "Amostras",
);
const warmups = parsePositiveInteger(
  process.env.BENCHMARK_WARMUPS,
  DEFAULT_WARMUPS,
  "Aquecimentos",
);
const routes = [
  {
    name: "estatísticas avançadas",
    path: "/2026/liga-de-desenvolvimento/sub-15/jogadores",
  },
  {
    name: "detalhe de jogo FIBA",
    path: "/2026/copa-es-ouro/fixture-fiba/jogos/63",
  },
];

const results = [];
for (const route of routes) {
  results.push(await measureRoute(baseUrl, route, samples, warmups));
}

process.stdout.write(
  `${JSON.stringify(
    {
      baseUrl,
      measuredAt: new Date().toISOString(),
      warmups,
      targets: { p50Ms: 1000, p95Ms: 1500 },
      results,
    },
    null,
    2,
  )}\n`,
);
