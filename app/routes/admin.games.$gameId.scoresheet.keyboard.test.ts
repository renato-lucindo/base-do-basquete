import { beforeEach, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { action, loader } from "./admin.games.$gameId.scoresheet.keyboard";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdminAal2).mockResolvedValue({
    client: { rpc },
    payload: { csrfToken: "fixture" },
    cookie: "refreshed-cookie",
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});
const doc = {
  rulesVersion: "FIBA_2024",
  periods: 4,
  coachPlayer: { home: null, away: null },
  roster: [
    { rosterEntryId: 1, registrationId: 10, side: "home", jersey: "12", played: true },
    { rosterEntryId: 2, registrationId: 20, side: "away", jersey: "12", played: true },
  ],
  events: [],
};
function args(payload: unknown, csrf = "fixture", origin = "https://example.test") {
  const form = new FormData();
  form.set("payload", JSON.stringify(payload));
  form.set("csrfToken", csrf);
  return {
    request: new Request("https://example.test/api/admin/games/42/keyboard-scoresheet", {
      method: "POST",
      headers: { Origin: origin },
      body: form,
    }),
    params: { gameId: "42" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof action>[0];
}
const request = {
  requestId: "10000000-0000-4000-8000-000000000001",
  baseVersion: 0,
  document: doc,
  confirm: false,
  reason: "",
};
it("rejects cross-origin and invalid CSRF before database writes", async () => {
  await expect(action(args(request, "fixture", "https://attacker.test"))).rejects.toMatchObject({
    status: 403,
  });
  await expect(action(args(request, "wrong"))).rejects.toMatchObject({ status: 403 });
  expect(rpc).not.toHaveBeenCalled();
});
it("revalidates data on the server and rejects forged event targets", async () => {
  const result = await action(
    args({
      ...request,
      document: {
        ...doc,
        events: [{ id: request.requestId, side: "home", period: 1, target: "99", code: "3" }],
      },
    }),
  );
  expect(result).toMatchObject({ init: { status: 400 } });
  expect(rpc).not.toHaveBeenCalled();
});
it("sends only validated source events to the authoritative RPC", async () => {
  rpc.mockResolvedValue({
    data: { version: 1, confirmed: false, requestId: request.requestId },
    error: null,
  });
  const result = await action(args(request));
  expect(rpc).toHaveBeenCalledWith(
    "admin_save_keyboard_scoresheet",
    expect.objectContaining({ p_game_id: 42, p_base_version: 0, p_document: doc }),
  );
  expect(result).toMatchObject({
    data: { version: 1 },
    init: { headers: { "Cache-Control": "private, no-store", "Set-Cookie": "refreshed-cookie" } },
  });
});
it("returns a conflict without overwriting another tab", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "BD905" } });
  expect(await action(args(request))).toMatchObject({
    init: { status: 409 },
    data: { error: expect.stringContaining("outra aba") },
  });
});

function chain(data: unknown[], error: { code?: string } | null = null) {
  const result = { data, error };
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  // O builder do PostgREST é awaitable; simule a propriedade dinamicamente.
  // biome-ignore lint/suspicious/noThenProperty: PostgREST expõe um builder intencionalmente awaitable neste mock.
  Object.defineProperty(builder, "then", {
    value: (resolve: (value: typeof result) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  });
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: data[0] ?? null, error });
  builder.maybeSingle.mockResolvedValue({ data: data[0] ?? null, error });
  return builder;
}
function keyboardLoaderArgs() {
  return {
    request: new Request("https://example.test/admin/games/42/scoresheet/keyboard"),
    params: { gameId: "42" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof loader>[0];
}
function mockKeyboardLoader(publicNameMissing: boolean, primarySource = "manual_scoresheet") {
  const participants = [
    { registration_id: 10, side: "home" },
    { registration_id: 20, side: "away" },
  ];
  const registrationRows = [
    { id: 10, team_id: 101, public_name: "Azul inscrição A", status: "confirmed" },
    { id: 20, team_id: 101, public_name: "Azul inscrição B", status: "confirmed" },
  ];
  const registrations = chain(registrationRows);
  if (publicNameMissing) {
    registrations.select
      .mockReturnValueOnce(chain([], { code: "42703" }))
      .mockReturnValueOnce(chain(registrationRows.map(({ public_name: _name, ...row }) => row)));
  }
  const fixtures: Record<string, ReturnType<typeof chain>> = {
    games: chain([{ id: 42, competition_id: 1, game_number: 7, matchup_id: 100 }]),
    competitions: chain([{ data_profile_id: 11 }]),
    series_category_data_profiles: chain([{ primary_source: primarySource }]),
    game_participants: chain(participants),
    keyboard_scoresheets: chain([]),
    roster_entries: chain([
      { id: 1, registration_id: 10, player_id: 11, jersey_number: "12" },
      { id: 2, registration_id: 20, player_id: 22, jersey_number: "12" },
    ]),
    team_registrations: registrations,
    players: chain([
      { id: 11, full_name: "Um" },
      { id: 22, full_name: "Dois" },
    ]),
    teams: chain([{ id: 101, name: "Equipe base" }]),
  };
  vi.mocked(requireAdminAal2).mockResolvedValue({
    client: { from: vi.fn((table: string) => fixtures[table]) },
    payload: { csrfToken: "fixture" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
}
it("exibe a inscrição correta para equipes com a mesma entidade global", async () => {
  mockKeyboardLoader(false);
  const response = await loader(keyboardLoaderArgs());
  expect(response.data.editor.teams).toEqual({
    home: "Azul inscrição A",
    away: "Azul inscrição B",
  });
  expect(response.data.editor.candidates.map((candidate) => candidate.side)).toEqual([
    "home",
    "away",
  ]);
});
it("carrega o editor com o nome antigo quando public_name não existe", async () => {
  mockKeyboardLoader(true);
  const response = await loader(keyboardLoaderArgs());
  expect(response.data.editor.teams).toEqual({ home: "Equipe base", away: "Equipe base" });
});

it("marks FIBA games as emergency fallback requiring a reason", async () => {
  mockKeyboardLoader(false, "fiba_boxscore");
  const response = await loader(keyboardLoaderArgs());
  expect(response.data.editor.requiresFallback).toBe(true);
});
it("returns service unavailable rather than validation error on transient PostgREST failure", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
  expect(await action(args(request))).toMatchObject({
    init: { status: 503 },
    data: { error: expect.stringContaining("identidade de reenvio") },
  });
});
it("reports a missing emergency fallback reason as validation, not infrastructure error", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "BD715" } });
  expect(
    await action(
      args({
        ...request,
        confirm: true,
        document: {
          ...doc,
          events: [{ id: request.requestId, side: "home", period: 1, target: "12", code: "2" }],
        },
      }),
    ),
  ).toMatchObject({
    init: { status: 400 },
    data: { error: expect.stringContaining("fallback emergencial") },
  });
});
