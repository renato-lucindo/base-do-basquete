import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { ScoresheetStep } from "../modules/scoresheet/editor";
import {
  describeScoresheetUnavailability,
  loader,
  default as NewManualScoresheet,
  ScoresheetUnavailableState,
} from "./admin.competitions.$competitionId.scoresheets.new";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));

const authorization = vi.mocked(requireAdminAal2);
const client = { from: vi.fn() };

function query(data: unknown[], error: unknown = null) {
  const result = { data, error };
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockResolvedValue(result);
  builder.not.mockReturnValue(builder);
  builder.order.mockResolvedValue(result);
  builder.limit.mockResolvedValue(result);
  return builder;
}

function loaderArgs() {
  return {
    request: new Request("https://example.test/admin/competitions/100/scoresheets/new"),
    params: { competitionId: "100" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof loader>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  const tables = {
    competitions: query([
      { id: 100, display_name: "Liga de teste", status: "draft", data_profile_id: null },
    ]),
    team_registrations: query([]),
    teams: query([]),
    roster_entries: query([]),
    manual_scoresheet_prefill: query([]),
    games: query([]),
  } as Record<string, ReturnType<typeof query>>;
  client.from.mockImplementation((table: string) => tables[table]);
  authorization.mockResolvedValue({
    client,
    payload: { csrfToken: "test-csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});

describe("manual scoresheet availability guidance", () => {
  it("asks for confirmed teams before the remaining prerequisites", () => {
    expect(
      describeScoresheetUnavailability({
        hasStructuralGames: true,
        hasMinimumConfirmedRegistrations: true,
        hasMinimumRegistrationsWithRoster: true,
        hasIncompleteParticipants: false,
        hasUnconfirmedParticipant: true,
        hasParticipantWithoutRoster: false,
      }),
    ).toEqual({
      action: "hub",
      message: "Confirme as equipes do confronto antes de preencher a súmula.",
    });
  });

  it("points to the roster when the teams are already confirmed", () => {
    expect(
      describeScoresheetUnavailability({
        hasStructuralGames: true,
        hasMinimumConfirmedRegistrations: true,
        hasMinimumRegistrationsWithRoster: true,
        hasIncompleteParticipants: false,
        hasUnconfirmedParticipant: false,
        hasParticipantWithoutRoster: true,
      }),
    ).toEqual({
      action: "hub",
      message: "Adicione atletas aos elencos das equipes do confronto.",
    });
  });

  it("points to the schedule when teams and rosters are ready", () => {
    expect(
      describeScoresheetUnavailability({
        hasStructuralGames: false,
        hasMinimumConfirmedRegistrations: true,
        hasMinimumRegistrationsWithRoster: true,
        hasIncompleteParticipants: false,
        hasUnconfirmedParticipant: false,
        hasParticipantWithoutRoster: false,
      }),
    ).toEqual({
      action: "schedule",
      message: "Organize um confronto na agenda antes de preencher a súmula.",
    });
  });

  it("asks for matchup review when scheduled games are still ineligible", () => {
    expect(
      describeScoresheetUnavailability({
        hasStructuralGames: true,
        hasMinimumConfirmedRegistrations: true,
        hasMinimumRegistrationsWithRoster: true,
        hasIncompleteParticipants: true,
        hasUnconfirmedParticipant: false,
        hasParticipantWithoutRoster: false,
      }),
    ).toEqual({
      action: "schedule",
      message: "Defina mandante e visitante para o confronto na agenda.",
    });
  });

  it("returns guidance instead of a 409 when no structural game exists", async () => {
    const response = (await loader(loaderArgs())) as unknown as {
      data: { unavailableIssue: { action: string; message: string } | null };
    };

    expect(response.data.unavailableIssue).toEqual({
      action: "hub",
      message: "Confirme pelo menos duas equipes antes de preencher uma súmula.",
    });
  });

  it("renders a contextual recovery action for team and roster issues", () => {
    const RouterStub = createRoutesStub([
      {
        path: "/",
        Component: () =>
          createElement(ScoresheetUnavailableState, {
            competitionId: 100,
            issue: { action: "hub", message: "Adicione atletas aos elencos." },
            requiresFallbackReason: false,
          }),
      },
    ]);
    const html = renderToStaticMarkup(createElement(RouterStub));

    expect(html).toContain("Revisar equipes e elencos");
    expect(html).toContain('href="/admin/competitions/100"');
    expect(html).not.toContain("Abrir agenda");
  });
});

describe("manual scoresheet step isolation", () => {
  it("marks inactive step content as hidden with a dedicated class", () => {
    const hidden = renderToStaticMarkup(
      createElement(
        ScoresheetStep,
        { active: false, label: "Revisão", stepNumber: 4 },
        createElement("p", null, "Revisão"),
      ),
    );
    const active = renderToStaticMarkup(
      createElement(
        ScoresheetStep,
        { active: true, label: "Jogo", stepNumber: 1 },
        createElement("p", null, "Jogo"),
      ),
    );

    expect(hidden).toContain('class="scoresheet-step"');
    expect(hidden).toContain("hidden");
    expect(hidden).toContain('aria-labelledby="scoresheet-step-4-heading"');
    expect(active).not.toContain("hidden");
    expect(active).toContain('id="scoresheet-step-1-heading"');
    expect(active).toContain('class="scoresheet-step-heading"');
    expect(active).toContain('tabindex="-1"');
  });
});

describe("entrada exclusiva por teclado", () => {
  it("mostra os jogos elegíveis sem renderizar a grade antiga", () => {
    const RouterStub = createRoutesStub([
      {
        path: "/",
        Component: () =>
          createElement(NewManualScoresheet, {
            loaderData: {
              competitionId: 100,
              competitionName: "Liga de teste",
              games: [
                {
                  id: 42,
                  number: 7,
                  homeName: "Equipe Azul",
                  awayName: "Equipe Ouro",
                  saved: false,
                },
                {
                  id: 43,
                  number: 8,
                  homeName: "Equipe Azul",
                  awayName: "Equipe Ouro",
                  saved: true,
                },
              ],
              unavailableIssue: null,
              migrationPending: false,
              fallbackProfile: false,
            },
          } as unknown as Parameters<typeof NewManualScoresheet>[0]),
      },
    ]);
    const html = renderToStaticMarkup(createElement(RouterStub));
    expect(html).toContain("Transcrever súmula por teclado");
    expect(html).toContain('href="/admin/games/42/scoresheet/keyboard"');
    expect(html).toContain('href="/admin/games/43/scoresheet/keyboard"');
    expect(html).toContain("Retomar ou corrigir");
    expect(html).not.toContain("Grade por períodos");
    expect(html).not.toContain("Cartões");
  });

  it("não permite iniciar lançamento quando a migration não está disponível", () => {
    const RouterStub = createRoutesStub([
      {
        path: "/",
        Component: () =>
          createElement(NewManualScoresheet, {
            loaderData: {
              competitionId: 100,
              competitionName: "Liga de teste",
              games: [{ id: 42, number: 7, homeName: "Azul", awayName: "Ouro", saved: false }],
              unavailableIssue: null,
              migrationPending: true,
              fallbackProfile: false,
            },
          } as unknown as Parameters<typeof NewManualScoresheet>[0]),
      },
    ]);
    const html = renderToStaticMarkup(createElement(RouterStub));
    expect(html).toContain("Gravação por teclado indisponível");
    expect(html).not.toContain('href="/admin/games/42/scoresheet/keyboard"');
  });
});

function readyGames(keyboardError: unknown = null) {
  const fixtures = {
    competitions: query([
      { id: 100, display_name: "Liga de teste", status: "draft", data_profile_id: null },
    ]),
    team_registrations: query([
      { id: 11, team_id: 21 },
      { id: 12, team_id: 22 },
    ]),
    roster_entries: query([{ registration_id: 11 }, { registration_id: 12 }]),
    teams: query([
      { id: 21, name: "Azul" },
      { id: 22, name: "Ouro" },
    ]),
    games: query([{ id: 42, game_number: 7, matchup_id: 5, status: "scheduled" }]),
    game_participants: query([
      { game_id: 42, registration_id: 11, side: "home" },
      { game_id: 42, registration_id: 12, side: "away" },
    ]),
    keyboard_scoresheets: query([], keyboardError),
  } as Record<string, ReturnType<typeof query>>;
  client.from.mockImplementation((table: string) => fixtures[table]);
}

describe("encaminhamento do jogo para o novo editor", () => {
  it("abre diretamente o editor do único jogo elegível", async () => {
    readyGames();
    try {
      await loader(loaderArgs());
      throw new Error("Esperava redirecionamento");
    } catch (cause) {
      expect(cause).toBeInstanceOf(Response);
      const response = cause as Response;
      expect(response.headers.get("location")).toBe("/admin/games/42/scoresheet/keyboard");
    }
  });

  it("informa falta de migration e evita redirecionar ao lançamento", async () => {
    readyGames({ code: "42P01", message: "relation missing" });
    const result = await loader(loaderArgs());
    expect(result).not.toBeInstanceOf(Response);
    const payload = result as { data: { migrationPending: boolean; games: unknown[] } };
    expect(payload.data.migrationPending).toBe(true);
    expect(payload.data.games).toHaveLength(1);
  });
});
