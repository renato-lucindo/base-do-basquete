import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "../modules/competition/context";
import type { BoxscoreStatisticsPageDto } from "../modules/statistics/boxscore-statistics-domain";
import { BoxscoreStatisticsExplorer } from "./boxscore-statistics-explorer";

const context: CompetitionContext = {
  competitionId: 7,
  dataProfile: { id: 3, primarySource: "fiba_boxscore", version: 2 },
  displayName: "Liga 2026",
  genderDivision: "male",
  statisticsMode: "boxscore",
  year: 2026,
  series: { id: 1, name: "Liga", slug: "liga" },
  category: { id: 1, name: "Adulto", slug: "adulto", hasAdvancedStats: true },
};

const cell = (value: number) => ({ status: "available" as const, value });
const data: BoxscoreStatisticsPageDto = {
  kind: "boxscore-v2",
  competitionId: 7,
  publicationId: 11,
  per30MinimumSeconds: 600,
  mode: "per-30",
  scope: "all",
  sort: "points",
  direction: "desc",
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
  rows: [
    {
      playerId: 9,
      playerName: "Atleta Azul",
      playerSlug: "atleta-azul",
      registrationId: 21,
      teamId: 31,
      teamName: "Azul",
      teamSlug: "azul",
      teamAbbreviation: "AZL",
      jersey: "var.",
      metrics: {
        games: cell(2),
        minutes: cell(10),
        points: { status: "insufficient-sample", value: null },
        rebounds: cell(9),
        offensiveRebounds: cell(3),
        defensiveRebounds: cell(6),
        assists: cell(4),
        turnovers: cell(1),
        blocks: cell(1),
        steals: cell(2),
        foulsCommitted: cell(2),
        foulsReceived: { status: "unavailable", value: null },
        fieldGoalsMade: cell(4),
        fieldGoalsAttempted: cell(10),
        threePointersMade: cell(2),
        threePointersAttempted: cell(5),
        freeThrowsMade: cell(2),
        freeThrowsAttempted: cell(3),
        efficiency: cell(12),
        plusMinus: cell(4),
        fieldGoalPercentage: cell(40),
        threePointPercentage: cell(40),
        freeThrowPercentage: cell(66.7),
      },
    },
  ],
  compared: [],
  leaders: { rebounds: [9] },
  teams: [{ id: 31, name: "Azul", slug: "azul" }],
  playerOptions: [{ id: 9, name: "Atleta Azul", teamName: "Azul" }],
  coverage: { regularGames: 2, playoffGames: 1, unclassifiedGames: 1 },
};

const athlete = data.rows[0];
if (!athlete) throw new Error("A fixture de atleta é obrigatória");

describe("BoxscoreStatisticsExplorer", () => {
  it("renders the reference title, compact controls and all modes and scopes", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/?mode=per-30&scope=all"]}>
        <BoxscoreStatisticsExplorer context={context} data={data} />
      </MemoryRouter>,
    );
    expect(html).toContain("Por jogo");
    expect(html).toContain("Por 30 min.");
    expect(html).toContain("Fase regular");
    expect(html).toContain("Eliminatórias");
    expect(html).toContain("<h1>Liga</h1>");
    expect(html).toContain("Filtro de colunas");
    expect(html).toContain("Comparar jogadores");
    expect(html).toContain("<dialog");
    expect(html).toContain('aria-labelledby="comparison-title"');
  });

  it("groups shooting columns and keeps team and jersey in the pinned athlete cell", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/?scope=all"]}>
        <BoxscoreStatisticsExplorer context={context} data={{ ...data, mode: "per-game" }} />
      </MemoryRouter>,
    );
    expect(html).toContain("AC/AT");
    expect(html).toContain("LLC/LLT");
    expect(html).toContain("FG%");
    expect(html).toContain("3PC/3PT");
    expect(html).toContain("3P%");
    expect(html).toContain("4.0/10.0");
    expect(html).toContain("2.0/5.0");
    expect(html).toContain("+4.0");
    expect(html).toContain('class="reference-player"');
    expect(html).toContain('class="reference-team" title="Azul">AZL');
    expect(html).not.toContain('class="column-position"');
    expect(html).not.toContain('class="column-team"');
    expect(html).toContain('aria-sort="descending"');
  });

  it("hides MIN temporarily, explains unavailable states and exposes a keyboard region", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter
        initialEntries={["/?mode=per-30&scope=all&visible=minutes,points,rebounds,foulsReceived"]}
      >
        <BoxscoreStatisticsExplorer context={context} data={data} />
      </MemoryRouter>,
    );
    expect(html).not.toContain('<abbr title="Minutos">MIN</abbr>');
    expect(html).toContain('disabled="" type="checkbox" checked=""/>MIN');
    expect(html).toContain("Amostra insuficiente");
    expect(html).toContain("Dado não fornecido pela fonte");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("Líder:");
    expect(html).toContain("#var.");
  });

  it("waits for two selected players before rendering comparison results", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/?compare=9"]}>
        <BoxscoreStatisticsExplorer context={context} data={{ ...data, compared: [athlete] }} />
      </MemoryRouter>,
    );

    expect(html).toContain("Escolha dois jogadores para ver a comparação.");
    expect(html).not.toContain('class="reference-comparison-results"');
  });

  it("formats active filters and highlights comparison advantages", () => {
    const rival = {
      ...athlete,
      playerId: 10,
      playerName: "Atleta Verde",
      playerSlug: "atleta-verde",
      registrationId: 22,
      metrics: {
        ...athlete.metrics,
        points: cell(8),
        turnovers: cell(3),
      },
    };
    const compared = [
      {
        ...athlete,
        metrics: { ...athlete.metrics, points: cell(12), turnovers: cell(1) },
      },
      rival,
    ];
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/?scope=all&filters=points:%3E=:10&compare=9,10"]}>
        <BoxscoreStatisticsExplorer
          context={context}
          data={{
            ...data,
            mode: "per-game",
            compared,
            playerOptions: [
              ...data.playerOptions,
              { id: 10, name: "Atleta Verde", teamName: "Verde" },
            ],
          }}
        />
      </MemoryRouter>,
    );

    expect(html).toContain("PTS &gt;= 10");
    expect(html).toContain("Limpar todos");
    expect(html).toContain("Atleta Azul</strong><span>×</span><strong>Atleta Verde");
    expect(html).toContain('data-tone="better"');
    expect(html).toContain('data-tone="worse"');
    expect(html).toContain("quanto menor, melhor");
  });
});
