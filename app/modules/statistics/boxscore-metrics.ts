export const BOXSCORE_METRICS = {
  games: { label: "J", name: "Jogos", normalizable: false, lowerIsBetter: false },
  minutes: { label: "MIN", name: "Minutos", normalizable: false, lowerIsBetter: false },
  points: { label: "PTS", name: "Pontos", normalizable: true, lowerIsBetter: false },
  rebounds: { label: "REB", name: "Rebotes", normalizable: true, lowerIsBetter: false },
  offensiveRebounds: {
    label: "RO",
    name: "Rebotes ofensivos",
    normalizable: true,
    lowerIsBetter: false,
  },
  defensiveRebounds: {
    label: "RD",
    name: "Rebotes defensivos",
    normalizable: true,
    lowerIsBetter: false,
  },
  assists: { label: "AST", name: "Assistências", normalizable: true, lowerIsBetter: false },
  turnovers: { label: "ER", name: "Erros", normalizable: true, lowerIsBetter: true },
  blocks: { label: "TO", name: "Tocos", normalizable: true, lowerIsBetter: false },
  steals: {
    label: "BR",
    name: "Bolas recuperadas",
    normalizable: true,
    lowerIsBetter: false,
  },
  foulsCommitted: {
    label: "FC",
    name: "Faltas cometidas",
    normalizable: true,
    lowerIsBetter: true,
  },
  foulsReceived: {
    label: "FR",
    name: "Faltas recebidas",
    normalizable: true,
    lowerIsBetter: false,
  },
  fieldGoalsMade: {
    label: "AC",
    name: "Arremessos convertidos",
    normalizable: true,
    lowerIsBetter: false,
  },
  fieldGoalsAttempted: {
    label: "AT",
    name: "Arremessos tentados",
    normalizable: true,
    lowerIsBetter: false,
  },
  threePointersMade: {
    label: "3PC",
    name: "Cestas de três convertidas",
    normalizable: true,
    lowerIsBetter: false,
  },
  threePointersAttempted: {
    label: "3PT",
    name: "Cestas de três tentadas",
    normalizable: true,
    lowerIsBetter: false,
  },
  freeThrowsMade: {
    label: "LLC",
    name: "Lances livres convertidos",
    normalizable: true,
    lowerIsBetter: false,
  },
  freeThrowsAttempted: {
    label: "LLT",
    name: "Lances livres tentados",
    normalizable: true,
    lowerIsBetter: false,
  },
  efficiency: { label: "EF", name: "Eficiência", normalizable: true, lowerIsBetter: false },
  plusMinus: { label: "+/-", name: "Saldo em quadra", normalizable: false, lowerIsBetter: false },
  fieldGoalPercentage: {
    label: "AP",
    name: "Aproveitamento de arremessos",
    normalizable: false,
    lowerIsBetter: false,
  },
  threePointPercentage: {
    label: "3P%",
    name: "Aproveitamento de três pontos",
    normalizable: false,
    lowerIsBetter: false,
  },
  freeThrowPercentage: {
    label: "LL%",
    name: "Aproveitamento de lances livres",
    normalizable: false,
    lowerIsBetter: false,
  },
} as const;

export type BoxscoreMetric = keyof typeof BOXSCORE_METRICS;

export const BOXSCORE_METRIC_KEYS = Object.keys(BOXSCORE_METRICS) as BoxscoreMetric[];

export function isBoxscoreMetric(value: string): value is BoxscoreMetric {
  return Object.hasOwn(BOXSCORE_METRICS, value);
}
