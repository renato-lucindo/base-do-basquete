import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdminAal2 } from "../modules/auth/authorization.server";
import {
  describeScoresheetUnavailability,
  loader,
  ScoresheetUnavailableState,
} from "./admin.competitions.$competitionId.scoresheets.new";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));

const authorization = vi.mocked(requireAdminAal2);
const client = { from: vi.fn() };

function query(data: unknown[]) {
  const result = { data, error: null };
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
  builder.in.mockReturnValue(builder);
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
