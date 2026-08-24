import type {
  BoxscoreValidation,
  ParsedBoxscore,
  ParsedBoxscoreGameStatistics,
  ParsedBoxscorePlayer,
  ParsedBoxscoreTeam,
  ParsedBoxscoreTeamStatistics,
  PositionedTextItem,
  ShootingLine,
} from "./types";

export const FIBA_GENIUS_PARSER_VERSION = "fiba-genius-v2";

interface TextRow {
  y: number;
  items: PositionedTextItem[];
}

const MONTHS: Record<string, string> = {
  jan: "01",
  fev: "02",
  mar: "03",
  abr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  set: "09",
  out: "10",
  nov: "11",
  dez: "12",
};

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function rowsFromItems(items: PositionedTextItem[]): TextRow[] {
  const rows: TextRow[] = [];
  for (const item of items.filter((candidate) => compact(candidate.str))) {
    let row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 1.5);
    if (!row) {
      row = { y: item.y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }
  for (const row of rows) row.items.sort((left, right) => left.x - right.x);
  return rows.sort((left, right) => right.y - left.y);
}

function rowText(row: TextRow): string {
  return compact(
    row.items
      .map((item) => compact(item.str))
      .filter(Boolean)
      .join(" "),
  );
}

function requireMatch(value: string, pattern: RegExp, code: string): RegExpMatchArray {
  const match = value.match(pattern);
  if (!match) throw new Error(code);
  return match;
}

function requireValue<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}

function parseInteger(value: string | undefined, code: string): number {
  if (!value || !/^-?\d+$/.test(value)) throw new Error(code);
  return Number(value);
}

function parseShooting(value: string | undefined, code: string): ShootingLine {
  const match = requireMatch(value ?? "", /^(\d+)\/(\d+)$/, code);
  return { made: Number(match[1]), attempted: Number(match[2]) };
}

function itemIn(row: TextRow, minimum: number, maximum: number): string | undefined {
  return row.items
    .filter((item) => item.x >= minimum && item.x < maximum)
    .map((item) => compact(item.str))
    .find(Boolean);
}

function parseMinutes(value: string | undefined): number {
  const match = requireMatch(value ?? "", /^(\d{1,3}):(\d{2})$/, "BDB_PDF_PLAYER_MINUTES");
  const seconds = Number(match[2]);
  if (seconds > 59) throw new Error("BDB_PDF_PLAYER_MINUTES");
  return Number(match[1]) * 60 + seconds;
}

function parseClock(value: string | undefined, code: string): number {
  const match = requireMatch(value ?? "", /^(\d{1,3}):(\d{2})$/, code);
  const seconds = Number(match[2]);
  if (seconds > 59) throw new Error(code);
  return Number(match[1]) * 60 + seconds;
}

function parseDecimal(value: string | undefined, code: string): number {
  if (!value || !/^\d+(?:,\d+)?$/.test(value)) throw new Error(code);
  return Number(value.replace(",", "."));
}

function rowStartingWith(rows: TextRow[], label: string): TextRow | undefined {
  return rows.find((row) => rowText(row).startsWith(label));
}

function rowContaining(rows: TextRow[], label: string): TextRow | undefined {
  return rows.find((row) => rowText(row).includes(label));
}

function itemTextIn(row: TextRow, minimum: number, maximum: number): string | undefined {
  return compact(
    row.items
      .filter((item) => item.x >= minimum && item.x < maximum)
      .map((item) => item.str)
      .join(" "),
  );
}

function parseMetricPair(
  rows: TextRow[],
  label: string,
  code: string,
  parser: (value: string | undefined, code: string) => number = parseInteger,
): [number, number] {
  const row = rowContaining(rows, label);
  if (!row) throw new Error(code);
  return [parser(itemTextIn(row, 165, 230), code), parser(itemTextIn(row, 230, 290), code)];
}

function parseRightMetricPair(
  rows: TextRow[],
  label: string,
  code: string,
  parser: (value: string | undefined, code: string) => number = parseInteger,
): [number, number] {
  const row = rowContaining(rows, label);
  if (!row) throw new Error(code);
  return [parser(itemTextIn(row, 450, 510), code), parser(itemTextIn(row, 510, 570), code)];
}

function parseLeadingInteger(value: string | undefined, code: string): number {
  const match = requireMatch(value ?? "", /^(\d+)/, code);
  return Number(match[1]);
}

function parsePaintMetric(value: string | undefined): {
  points: number;
  made: number;
  attempted: number;
} {
  const match = requireMatch(
    value ?? "",
    /^(\d+)\s+\((\d+)\/(\d+)\)\s+\d+(?:,\d+)?$/,
    "BDB_PDF_TEAM_PAINT",
  );
  return {
    points: Number(match[1]),
    made: Number(match[2]),
    attempted: Number(match[3]),
  };
}

function parseTeamStatistics(rows: TextRow[]): {
  teams?: [ParsedBoxscoreTeamStatistics, ParsedBoxscoreTeamStatistics];
  game?: ParsedBoxscoreGameStatistics;
} {
  if (!rowStartingWith(rows, "Pontos de Erros")) return {};

  const pointsFromTurnovers = parseMetricPair(
    rows,
    "Pontos de Erros",
    "BDB_PDF_TEAM_POINTS_FROM_TURNOVERS",
  );
  const paintRow = requireValue(rowStartingWith(rows, "Pontos no Garrafão"), "BDB_PDF_TEAM_PAINT");
  const paint = [
    parsePaintMetric(itemTextIn(paintRow, 165, 230)),
    parsePaintMetric(itemTextIn(paintRow, 230, 290)),
  ] as const;
  const secondChancePoints = parseMetricPair(
    rows,
    "Pontos de Segunda Chance",
    "BDB_PDF_TEAM_SECOND_CHANCE",
  );
  const fastBreakPoints = parseMetricPair(
    rows,
    "Pontos de Contra-ataque",
    "BDB_PDF_TEAM_FAST_BREAK",
  );
  const fastBreakPointsFromTurnovers = parseMetricPair(
    rows,
    "Fast Break Points from Turnovers",
    "BDB_PDF_TEAM_FAST_BREAK_TURNOVERS",
  );
  const benchPoints = parseMetricPair(rows, "Pontos do Banco", "BDB_PDF_TEAM_BENCH");
  const largestLead = parseRightMetricPair(
    rows,
    "Maior Liderança",
    "BDB_PDF_TEAM_LARGEST_LEAD",
    parseLeadingInteger,
  );
  const largestScoringRun = parseRightMetricPair(
    rows,
    "Maior Sequência de Pontos",
    "BDB_PDF_TEAM_LARGEST_RUN",
    parseLeadingInteger,
  );
  const pointsPerPossession = parseRightMetricPair(
    rows,
    "Points per Possession",
    "BDB_PDF_TEAM_POSSESSION",
    parseDecimal,
  );
  const timeLeadingSeconds = parseRightMetricPair(
    rows,
    "Tempo na Liderança",
    "BDB_PDF_TEAM_TIME_LEADING",
    parseClock,
  );

  const leadChangesRow = requireValue(
    rowContaining(rows, "Mudanças na Liderança"),
    "BDB_PDF_GAME_LEAD_CHANGES",
  );
  const timesTiedRow = requireValue(
    rowContaining(rows, "Vezes Empatadas"),
    "BDB_PDF_GAME_TIMES_TIED",
  );
  const game = {
    leadChanges: parseInteger(itemTextIn(leadChangesRow, 490, 520), "BDB_PDF_GAME_LEAD_CHANGES"),
    timesTied: parseInteger(itemTextIn(timesTiedRow, 490, 520), "BDB_PDF_GAME_TIMES_TIED"),
  };

  return {
    teams: [0, 1].map((index) => ({
      pointsFromTurnovers: pointsFromTurnovers[index] as number,
      pointsInPaint: paint[index]?.points as number,
      pointsInPaintMade: paint[index]?.made as number,
      pointsInPaintAttempted: paint[index]?.attempted as number,
      secondChancePoints: secondChancePoints[index] as number,
      fastBreakPoints: fastBreakPoints[index] as number,
      fastBreakPointsFromTurnovers: fastBreakPointsFromTurnovers[index] as number,
      benchPoints: benchPoints[index] as number,
      largestLead: largestLead[index] as number,
      largestScoringRun: largestScoringRun[index] as number,
      pointsPerPossession: pointsPerPossession[index] as number,
      timeLeadingSeconds: timeLeadingSeconds[index] as number,
    })) as [ParsedBoxscoreTeamStatistics, ParsedBoxscoreTeamStatistics],
    game,
  };
}

function parseName(rows: TextRow[], rowIndex: number): { name: string; captain: boolean } {
  const statRow = requireValue(rows[rowIndex], "BDB_PDF_PLAYER_ROW");
  const fragments: Array<{ y: number; text: string }> = [];
  for (
    let index = Math.max(0, rowIndex - 2);
    index <= Math.min(rows.length - 1, rowIndex + 1);
    index += 1
  ) {
    const candidate = requireValue(rows[index], "BDB_PDF_PLAYER_ROW");
    if (Math.abs(candidate.y - statRow.y) > 6) continue;
    const text = compact(
      candidate.items
        .filter((item) => item.x >= 48 && item.x < 160)
        .map((item) => item.str)
        .join(" "),
    );
    if (text && text !== "Nome") fragments.push({ y: candidate.y, text });
  }
  fragments.sort((left, right) => right.y - left.y);
  const joined = compact(fragments.map((fragment) => fragment.text).join(" "));
  const captain = /\(C\)/i.test(joined);
  const name = compact(joined.replace(/\(C\)/gi, ""));
  if (!name || name.length > 160) throw new Error("BDB_PDF_PLAYER_NAME");
  return { name, captain };
}

function isPlayerRow(row: TextRow): boolean {
  const jersey = itemIn(row, 29, 48);
  const participation = itemIn(row, 158, 181);
  return (
    /^\*?(?:0|00|[1-9]\d?)$/.test(jersey ?? "") &&
    (/^\d{1,3}:\d{2}$/.test(participation ?? "") || participation === "NJ")
  );
}

function parsePlayer(rows: TextRow[], rowIndex: number): ParsedBoxscorePlayer {
  const row = requireValue(rows[rowIndex], "BDB_PDF_PLAYER_ROW");
  const rawJersey = itemIn(row, 29, 48) ?? "";
  const participation = itemIn(row, 158, 181);
  const { name, captain } = parseName(rows, rowIndex);
  const didNotPlay = participation === "NJ";
  const empty = { made: 0, attempted: 0 };
  if (didNotPlay) {
    return {
      jerseyNumber: rawJersey.replace("*", ""),
      name,
      starter: rawJersey.startsWith("*"),
      captain,
      didNotPlay: true,
      secondsPlayed: 0,
      fieldGoals: empty,
      twoPoints: empty,
      threePoints: empty,
      freeThrows: empty,
      offensiveRebounds: 0,
      defensiveRebounds: 0,
      rebounds: 0,
      assists: 0,
      turnovers: 0,
      steals: 0,
      blocks: 0,
      foulsCommitted: 0,
      foulsReceived: 0,
      plusMinus: 0,
      efficiency: 0,
      points: 0,
    };
  }
  return {
    jerseyNumber: rawJersey.replace("*", ""),
    name,
    starter: rawJersey.startsWith("*"),
    captain,
    didNotPlay: false,
    secondsPlayed: parseMinutes(participation),
    fieldGoals: parseShooting(itemIn(row, 184, 215), "BDB_PDF_PLAYER_FIELD_GOALS"),
    twoPoints: parseShooting(itemIn(row, 234, 264), "BDB_PDF_PLAYER_TWO_POINTS"),
    threePoints: parseShooting(itemIn(row, 282, 311), "BDB_PDF_PLAYER_THREE_POINTS"),
    freeThrows: parseShooting(itemIn(row, 326, 356), "BDB_PDF_PLAYER_FREE_THROWS"),
    offensiveRebounds: parseInteger(itemIn(row, 383, 400), "BDB_PDF_PLAYER_REBOUNDS"),
    defensiveRebounds: parseInteger(itemIn(row, 400, 414), "BDB_PDF_PLAYER_REBOUNDS"),
    rebounds: parseInteger(itemIn(row, 414, 429), "BDB_PDF_PLAYER_REBOUNDS"),
    assists: parseInteger(itemIn(row, 429, 442), "BDB_PDF_PLAYER_ASSISTS"),
    turnovers: parseInteger(itemIn(row, 442, 456), "BDB_PDF_PLAYER_TURNOVERS"),
    steals: parseInteger(itemIn(row, 456, 470), "BDB_PDF_PLAYER_STEALS"),
    blocks: parseInteger(itemIn(row, 470, 484), "BDB_PDF_PLAYER_BLOCKS"),
    foulsCommitted: parseInteger(itemIn(row, 484, 498), "BDB_PDF_PLAYER_FOULS"),
    foulsReceived: parseInteger(itemIn(row, 498, 513), "BDB_PDF_PLAYER_FOULS"),
    plusMinus: parseInteger(itemIn(row, 513, 527), "BDB_PDF_PLAYER_PLUS_MINUS"),
    efficiency: parseInteger(itemIn(row, 527, 543), "BDB_PDF_PLAYER_EFFICIENCY"),
    points: parseInteger(itemIn(row, 543, 560), "BDB_PDF_PLAYER_POINTS"),
  };
}

function parseTeamHeader(row: TextRow): { name: string; abbreviation: string } | null {
  const match = rowText(row).match(/^(.+?) \(([A-Z]{2,5})\)(?:\s|$)/);
  return match
    ? {
        name: compact(requireValue(match[1], "BDB_PDF_TEAM_HEADER")),
        abbreviation: requireValue(match[2], "BDB_PDF_TEAM_HEADER"),
      }
    : null;
}

function parseTeam(
  rows: TextRow[],
  headerIndex: number,
  score: number,
  periods: number[],
): ParsedBoxscoreTeam {
  const header = parseTeamHeader(requireValue(rows[headerIndex], "BDB_PDF_TEAM_HEADER"));
  if (!header) throw new Error("BDB_PDF_TEAM_HEADER");
  const players: ParsedBoxscorePlayer[] = [];
  let totalsFound = false;
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const candidate = requireValue(rows[index], "BDB_PDF_TEAM_TABLE");
    const text = rowText(candidate);
    if (text.startsWith("Totais ") || text === "Totais") {
      totalsFound = true;
      break;
    }
    if (parseTeamHeader(candidate)) break;
    if (isPlayerRow(candidate)) players.push(parsePlayer(rows, index));
  }
  if (!totalsFound || players.length < 5 || players.length > 12) {
    throw new Error("BDB_PDF_TEAM_TABLE");
  }
  return { ...header, score, periodScores: periods, players };
}

function parseScheduledLocal(text: string): string {
  const match = requireMatch(
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    /\b(\d{2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.\s+(\d{4}).*Hora de Inicio:\s*(\d{2}):(\d{2})/i,
    "BDB_PDF_SCHEDULE",
  );
  const month = MONTHS[requireValue(match[2], "BDB_PDF_SCHEDULE").toLowerCase()];
  if (!month) throw new Error("BDB_PDF_SCHEDULE");
  return `${requireValue(match[3], "BDB_PDF_SCHEDULE")}-${month}-${requireValue(match[1], "BDB_PDF_SCHEDULE")}T${requireValue(match[4], "BDB_PDF_SCHEDULE")}:${requireValue(match[5], "BDB_PDF_SCHEDULE")}`;
}

export function parseFibaGeniusBoxscore(pages: PositionedTextItem[][]): ParsedBoxscore {
  if (pages.length !== 1) throw new Error("BDB_PDF_PAGE_COUNT");
  const rows = rowsFromItems(requireValue(pages[0], "BDB_PDF_PAGE_COUNT"));
  const completeText = rows.map(rowText).join("\n");
  if (
    !completeText.includes("Box Score FIBA") ||
    !completeText.includes("Arremessos") ||
    !completeText.includes("Rebotes") ||
    !completeText.includes("Não jogou")
  ) {
    throw new Error("BDB_PDF_UNSUPPORTED_FORMAT");
  }
  const competitionName = requireValue(
    requireMatch(completeText, /^(.+?) Box Score FIBA$/m, "BDB_PDF_COMPETITION")[1],
    "BDB_PDF_COMPETITION",
  );
  const gameNumber = requireValue(
    requireMatch(completeText, /Jogo Nº:\s*([^\s]+)/, "BDB_PDF_GAME_NUMBER")[1],
    "BDB_PDF_GAME_NUMBER",
  );
  const duration = requireMatch(
    completeText,
    /Duração do Jogo:\s*(\d{2}):(\d{2})/,
    "BDB_PDF_DURATION",
  );
  const scoreRow = rows.find((row) => /\d+\s+[–-]\s+\d+/.test(rowText(row)));
  if (!scoreRow) throw new Error("BDB_PDF_SCORE");
  const scoreMatch = requireMatch(
    rowText(scoreRow),
    /^(.*?)\s+(\d+)\s+[–-]\s+(\d+)\s+(.*?)$/,
    "BDB_PDF_SCORE",
  );
  const periodMatch = requireMatch(
    completeText,
    /\((\d+(?:-\d+)(?:,\s*\d+-\d+){3,})\)/,
    "BDB_PDF_PERIODS",
  );
  const periodPairs = requireValue(periodMatch[1], "BDB_PDF_PERIODS")
    .split(/,\s*/)
    .map((pair) => {
      const values = pair.split("-").map(Number);
      return [
        requireValue(values[0], "BDB_PDF_PERIODS"),
        requireValue(values[1], "BDB_PDF_PERIODS"),
      ] as const;
    });
  const headerIndexes = rows
    .map((row, index) => (parseTeamHeader(row) ? index : -1))
    .filter((index) => index >= 0);
  if (headerIndexes.length !== 2) throw new Error("BDB_PDF_TEAM_COUNT");
  const venueAndDate = rows.find((row) => rowText(row).includes("Hora de Início:"));
  if (!venueAndDate) throw new Error("BDB_PDF_SCHEDULE");
  const venue = compact(requireValue(rowText(venueAndDate).split(",")[0], "BDB_PDF_SCHEDULE"));
  const statistics = parseTeamStatistics(rows);
  const result: ParsedBoxscore = {
    format: "FIBA_GENIUS_SPORTS",
    parserVersion: FIBA_GENIUS_PARSER_VERSION,
    competitionName: compact(competitionName),
    gameNumber,
    scheduledLocal: parseScheduledLocal(rowText(venueAndDate)),
    durationSeconds:
      Number(requireValue(duration[1], "BDB_PDF_DURATION")) * 3600 +
      Number(requireValue(duration[2], "BDB_PDF_DURATION")) * 60,
    venue,
    teams: [
      {
        ...parseTeam(
          rows,
          requireValue(headerIndexes[0], "BDB_PDF_TEAM_COUNT"),
          Number(requireValue(scoreMatch[2], "BDB_PDF_SCORE")),
          periodPairs.map((pair) => pair[0]),
        ),
        teamStatistics: statistics.teams?.[0],
      },
      {
        ...parseTeam(
          rows,
          requireValue(headerIndexes[1], "BDB_PDF_TEAM_COUNT"),
          Number(requireValue(scoreMatch[3], "BDB_PDF_SCORE")),
          periodPairs.map((pair) => pair[1]),
        ),
        teamStatistics: statistics.teams?.[1],
      },
    ],
    gameStatistics: statistics.game,
    warnings: [],
  };
  const validation = validateParsedBoxscore(result);
  if (!validation.valid) {
    throw new Error(requireValue(validation.issues[0], "BDB_PDF_INVALID").code);
  }
  return result;
}

export function validateParsedBoxscore(boxscore: ParsedBoxscore): BoxscoreValidation {
  const issues: BoxscoreValidation["issues"] = [];
  const periodCount = boxscore.teams[0].periodScores.length;
  const gameClockSeconds = 2400 + Math.max(periodCount - 4, 0) * 300;
  if (boxscore.teams[0].name === boxscore.teams[1].name) {
    issues.push({ code: "BDB_PDF_DUPLICATE_TEAM", message: "As equipes devem ser diferentes." });
  }
  for (const team of boxscore.teams) {
    const playerPoints = team.players.reduce((total, player) => total + player.points, 0);
    const periodPoints = team.periodScores.reduce((total, points) => total + points, 0);
    if (playerPoints !== team.score) {
      issues.push({
        code: "BDB_PDF_PLAYER_TOTAL",
        message: `A soma dos atletas de ${team.name} diverge do placar.`,
      });
    }
    if (periodPoints !== team.score) {
      issues.push({
        code: "BDB_PDF_PERIOD_TOTAL",
        message: `A soma dos períodos de ${team.name} diverge do placar.`,
      });
    }
    const jerseys = team.players.map((player) => player.jerseyNumber);
    if (new Set(jerseys).size !== jerseys.length) {
      issues.push({
        code: "BDB_PDF_DUPLICATE_JERSEY",
        message: `Há camisa duplicada em ${team.name}.`,
      });
    }
    for (const player of team.players) {
      if (
        player.fieldGoals.made !== player.twoPoints.made + player.threePoints.made ||
        player.fieldGoals.attempted !== player.twoPoints.attempted + player.threePoints.attempted
      ) {
        issues.push({
          code: "BDB_PDF_SHOOTING_TOTAL",
          message: `Os arremessos de ${player.name} são inconsistentes.`,
        });
      }
      if (player.rebounds !== player.offensiveRebounds + player.defensiveRebounds) {
        issues.push({
          code: "BDB_PDF_REBOUND_TOTAL",
          message: `Os rebotes de ${player.name} são inconsistentes.`,
        });
      }
      const calculatedPoints =
        player.twoPoints.made * 2 + player.threePoints.made * 3 + player.freeThrows.made;
      if (calculatedPoints !== player.points) {
        issues.push({
          code: "BDB_PDF_POINTS",
          message: `Os pontos de ${player.name} são inconsistentes.`,
        });
      }
    }
    const stats = team.teamStatistics;
    if (
      stats &&
      (stats.pointsInPaintMade > stats.pointsInPaintAttempted ||
        stats.pointsInPaint !== stats.pointsInPaintMade * 2 ||
        stats.fastBreakPointsFromTurnovers > stats.fastBreakPoints ||
        stats.timeLeadingSeconds > gameClockSeconds ||
        Object.values(stats).some((value) => value < 0))
    ) {
      issues.push({
        code: "BDB_PDF_TEAM_STATISTICS",
        message: `Os indicadores coletivos de ${team.name} são inconsistentes.`,
      });
    }
  }
  const teamStatistics = boxscore.teams.map((team) => team.teamStatistics);
  if (
    boxscore.parserVersion === FIBA_GENIUS_PARSER_VERSION &&
    (teamStatistics.some((statistics) => !statistics) || !boxscore.gameStatistics)
  ) {
    issues.push({
      code: "BDB_PDF_TEAM_STATISTICS_MISSING",
      message: "O bloco de estatísticas coletivas FIBA/Genius está ausente.",
    });
  }
  if (
    teamStatistics.every((statistics) => statistics) &&
    teamStatistics.reduce((total, statistics) => total + (statistics?.timeLeadingSeconds ?? 0), 0) >
      gameClockSeconds
  ) {
    issues.push({
      code: "BDB_PDF_TEAM_STATISTICS",
      message: "A soma do tempo em vantagem excede o tempo regulamentar do jogo.",
    });
  }
  if (
    boxscore.gameStatistics &&
    (boxscore.gameStatistics.leadChanges < 0 || boxscore.gameStatistics.timesTied < 0)
  ) {
    issues.push({
      code: "BDB_PDF_GAME_STATISTICS",
      message: "Os indicadores gerais do jogo são inconsistentes.",
    });
  }
  return { valid: issues.length === 0, issues };
}
