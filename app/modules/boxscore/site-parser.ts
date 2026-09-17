import type {
  ParsedBoxscore,
  ParsedBoxscorePlayer,
  ParsedBoxscoreTeam,
  PositionedTextItem,
} from "./types";

export const BASKETBALL_SITE_PARSER_VERSION = "basketball-site-v1";

interface TextRow {
  page: number;
  y: number;
  items: PositionedTextItem[];
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function rowsFromPages(pages: PositionedTextItem[][]): TextRow[] {
  return pages.flatMap((items, page) => {
    const rows: TextRow[] = [];
    for (const item of items.filter((candidate) => compact(candidate.str))) {
      let row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 1.5);
      if (!row) {
        row = { page, y: item.y, items: [] };
        rows.push(row);
      }
      row.items.push(item);
    }
    for (const row of rows) row.items.sort((left, right) => left.x - right.x);
    return rows.sort((left, right) => right.y - left.y);
  });
}

function rowText(row: TextRow): string {
  return compact(row.items.map((item) => item.str).join(" "));
}

function itemTextIn(row: TextRow, minimum: number, maximum: number): string | undefined {
  const value = compact(
    row.items
      .filter((item) => item.x >= minimum && item.x < maximum)
      .map((item) => item.str)
      .join(" "),
  );
  return value || undefined;
}

function parseInteger(value: string | undefined, code: string): number {
  if (!value || !/^-?\d+$/.test(value)) throw new Error(code);
  return Number(value);
}

function parseMinutes(value: string | undefined): number {
  const match = value?.match(/^(\d{1,3}):(\d{2})$/);
  if (!match || Number(match[2]) > 59) throw new Error("BDB_PDF_PLAYER_MINUTES");
  return Number(match[1]) * 60 + Number(match[2]);
}

function isPlayerRow(row: TextRow): boolean {
  return (
    /^(?:0|00|[1-9]\d?)$/.test(itemTextIn(row, 30, 60) ?? "") &&
    Boolean(itemTextIn(row, 60, 169)) &&
    /^\d{1,3}:\d{2}$/.test(itemTextIn(row, 360, 390) ?? "")
  );
}

function parsePlayer(row: TextRow): ParsedBoxscorePlayer {
  const fieldGoalAttempted = parseInteger(itemTextIn(row, 235, 250), "BDB_PDF_PLAYER_FIELD_GOALS");
  const fieldGoalMade = parseInteger(itemTextIn(row, 250, 270), "BDB_PDF_PLAYER_FIELD_GOALS");
  const threePointAttempted = parseInteger(
    itemTextIn(row, 480, 505),
    "BDB_PDF_PLAYER_THREE_POINTS",
  );
  const threePointMade = parseInteger(itemTextIn(row, 505, 525), "BDB_PDF_PLAYER_THREE_POINTS");
  if (threePointMade > fieldGoalMade || threePointAttempted > fieldGoalAttempted) {
    throw new Error("BDB_PDF_PLAYER_SHOOTING_TOTAL");
  }
  return {
    jerseyNumber: itemTextIn(row, 30, 60) as string,
    name: itemTextIn(row, 60, 169) as string,
    starter: false,
    captain: false,
    didNotPlay: false,
    secondsPlayed: parseMinutes(itemTextIn(row, 360, 390)),
    fieldGoals: { made: fieldGoalMade, attempted: fieldGoalAttempted },
    twoPoints: {
      made: fieldGoalMade - threePointMade,
      attempted: fieldGoalAttempted - threePointAttempted,
    },
    threePoints: { made: threePointMade, attempted: threePointAttempted },
    freeThrows: {
      made: parseInteger(itemTextIn(row, 325, 340), "BDB_PDF_PLAYER_FREE_THROWS"),
      attempted: parseInteger(itemTextIn(row, 308, 325), "BDB_PDF_PLAYER_FREE_THROWS"),
    },
    offensiveRebounds: parseInteger(itemTextIn(row, 425, 445), "BDB_PDF_PLAYER_REBOUNDS"),
    defensiveRebounds: parseInteger(itemTextIn(row, 405, 425), "BDB_PDF_PLAYER_REBOUNDS"),
    rebounds: parseInteger(itemTextIn(row, 445, 465), "BDB_PDF_PLAYER_REBOUNDS"),
    assists: parseInteger(itemTextIn(row, 165, 185), "BDB_PDF_PLAYER_ASSISTS"),
    turnovers: parseInteger(itemTextIn(row, 545, 570), "BDB_PDF_PLAYER_TURNOVERS"),
    steals: parseInteger(itemTextIn(row, 465, 480), "BDB_PDF_PLAYER_STEALS"),
    blocks: parseInteger(itemTextIn(row, 185, 200), "BDB_PDF_PLAYER_BLOCKS"),
    foulsCommitted: parseInteger(itemTextIn(row, 290, 308), "BDB_PDF_PLAYER_FOULS"),
    foulsReceived: null,
    plusMinus: null,
    efficiency: parseInteger(itemTextIn(row, 214, 235), "BDB_PDF_PLAYER_EFFICIENCY"),
    points: parseInteger(itemTextIn(row, 390, 405), "BDB_PDF_PLAYER_POINTS"),
  };
}

function abbreviation(name: string): string {
  const ignored = new Set(["da", "das", "de", "do", "dos", "e"]);
  return name
    .split(/\s+/)
    .filter((part) => !ignored.has(part.toLocaleLowerCase("pt-BR")))
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 5);
}

function parseTeam(name: string, rows: TextRow[]): ParsedBoxscoreTeam {
  const players = rows.filter(isPlayerRow).map(parsePlayer);
  const totals = rows.find((row) => rowText(row).startsWith("Totais"));
  if (!totals || players.length < 5 || players.length > 12) throw new Error("BDB_PDF_TEAM_TABLE");
  return {
    name,
    abbreviation: abbreviation(name),
    score: parseInteger(itemTextIn(totals, 390, 405), "BDB_PDF_SCORE"),
    periodScores: null,
    players,
  };
}

export function parseBasketballSiteBoxscore(pages: PositionedTextItem[][]): ParsedBoxscore {
  if (pages.length < 1 || pages.length > 4) throw new Error("BDB_PDF_PAGE_COUNT");
  const rows = rowsFromPages(pages);
  const completeText = rows.map(rowText).join("\n");
  if (!completeText.includes("Ficha do Jogo") || !completeText.includes("Date / Time:")) {
    throw new Error("BDB_PDF_UNSUPPORTED_FORMAT");
  }
  const headers = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const text = rowText(row);
      const firstItem = row.items[0];
      return (
        row.page === 0 &&
        row.items.length === 1 &&
        Boolean(firstItem && firstItem.x >= 30 && firstItem.x < 60) &&
        !["Ficha do Jogo", "Legend"].includes(text) &&
        rows
          .slice(rows.indexOf(row) + 1, rows.indexOf(row) + 5)
          .some((next) => rowText(next).includes("ASS"))
      );
    });
  if (headers.length !== 2) throw new Error("BDB_PDF_TEAM_COUNT");
  const first = headers[0];
  const second = headers[1];
  if (!first || !second) throw new Error("BDB_PDF_TEAM_COUNT");
  const scheduleRow = rows.find((row) => rowText(row).includes("Date / Time:"));
  if (!scheduleRow) throw new Error("BDB_PDF_SCHEDULE");
  const scheduleMatch = rowText(scheduleRow).match(
    /Date \/ Time:\s*(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2})\s+Ginásio:\s*(.+)$/,
  );
  if (!scheduleMatch) throw new Error("BDB_PDF_SCHEDULE");
  const teams: [ParsedBoxscoreTeam, ParsedBoxscoreTeam] = [
    parseTeam(rowText(first.row), rows.slice(first.index + 1, second.index)),
    parseTeam(rowText(second.row), rows.slice(second.index + 1)),
  ];
  return {
    format: "BASKETBALL_SITE",
    parserVersion: BASKETBALL_SITE_PARSER_VERSION,
    competitionName: null,
    gameNumber: null,
    scheduledLocal: `${scheduleMatch[3]}-${scheduleMatch[2]}-${scheduleMatch[1]}T${scheduleMatch[4]}:${scheduleMatch[5]}`,
    durationSeconds: null,
    venue: compact(scheduleMatch[6] ?? ""),
    teams,
    warnings: [
      "O documento não informa parciais por período, número da partida, competição ou duração.",
      "O documento não informa plus/minus, faltas recebidas nem estatísticas coletivas.",
    ],
  };
}
