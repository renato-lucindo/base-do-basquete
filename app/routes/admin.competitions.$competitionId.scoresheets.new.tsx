import { data, redirect } from "react-router";

import type { Route } from "./+types/admin.competitions.$competitionId.scoresheets.new";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { normalizeJersey } from "../modules/competition/admin-domain";
import { ManualScoresheetEditor } from "../modules/scoresheet/editor";
import {
  deriveTeamScore,
  evaluateDisqualification,
  parseFoulCodes,
  parseNonnegativeInteger,
  type FoulInput,
  type ManualScoresheetPayload,
  type PeriodPayload,
  type TeamPayload,
  type TeamSide,
} from "../modules/scoresheet/domain";
import type { Json } from "../types/database.generated";

function parseId(value: string | FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value : "";
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : null;
}

function badRequest(message: string) {
  return data({ error: message }, { status: 400 });
}

function mapScoresheetError(code: string | undefined): string {
  switch (code) {
    case "BD401":
      return "Confirme o segundo fator antes de salvar.";
    case "BD202":
      return "A edição ou uma das equipes não está mais elegível.";
    case "BD203":
      return "Revise data, hora, local e número do jogo.";
    case "BD204":
      return "Um atleta não pertence mais ao elenco selecionado.";
    case "BD205":
      return "Há atleta, camisa ou número de jogo duplicado.";
    case "BD206":
      return "Revise períodos, conversões, faltas e prorrogações.";
    case "BD207":
      return "Existem dados posteriores à desqualificação por GD.";
    case "BD208":
      return "O jogo está empatado. Adicione uma prorrogação antes de encerrar.";
    case "BD209":
      return "A chave desta submissão já foi usada com outro conteúdo.";
    default:
      return "Não foi possível salvar a súmula.";
  }
}

export function meta() {
  return [{ title: "Nova súmula manual — Base do Basquete" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);

  const competitionResult = await auth.client
    .from("competitions")
    .select("id,display_name,status")
    .eq("id", competitionId)
    .limit(1);
  if (competitionResult.error) throw new Error("Manual scoresheet context query failed");
  const competition = competitionResult.data[0];
  if (!competition || competition.status !== "published") {
    throw new Response("Edição indisponível", { status: 404 });
  }

  const [registrationsResult, teamsResult, rosterResult, playersResult, prefillResult] =
    await Promise.all([
      auth.client
        .from("team_registrations")
        .select("id,team_id")
        .eq("competition_id", competitionId)
        .eq("status", "confirmed")
        .order("id"),
      auth.client.from("teams").select("id,name").eq("is_active", true).order("name"),
      auth.client
        .from("roster_entries")
        .select("id,registration_id,player_id,jersey_number")
        .eq("competition_id", competitionId)
        .eq("status", "active")
        .order("id"),
      auth.client.from("players").select("id,full_name").eq("is_active", true),
      auth.client
        .from("manual_scoresheet_prefill")
        .select("registration_id,slot_number,roster_entry_id,jersey_number")
        .eq("competition_id", competitionId)
        .order("slot_number"),
    ]);

  if (
    registrationsResult.error ||
    teamsResult.error ||
    rosterResult.error ||
    playersResult.error ||
    prefillResult.error
  ) {
    throw new Error("Manual scoresheet context query failed");
  }

  const teamNames = new Map(teamsResult.data.map((team) => [team.id, team.name]));
  const playerNames = new Map(playersResult.data.map((player) => [player.id, player.full_name]));
  const registrations = registrationsResult.data
    .map((registration) => ({
      id: registration.id,
      teamName: teamNames.get(registration.team_id) ?? "Equipe indisponível",
      roster: rosterResult.data
        .filter((entry) => entry.registration_id === registration.id)
        .map((entry) => ({
          rosterEntryId: entry.id,
          playerName: playerNames.get(entry.player_id) ?? "Atleta indisponível",
          jerseyNumber: entry.jersey_number,
        })),
      previous: prefillResult.data
        .filter((entry) => entry.registration_id === registration.id)
        .filter(
          (
            entry,
          ): entry is {
            registration_id: number;
            slot_number: number;
            roster_entry_id: number;
            jersey_number: string;
          } =>
            entry.registration_id !== null &&
            entry.slot_number !== null &&
            entry.roster_entry_id !== null &&
            entry.jersey_number !== null,
        )
        .map((entry) => ({
          slotNumber: entry.slot_number,
          rosterEntryId: entry.roster_entry_id,
          jerseyNumber: entry.jersey_number,
        })),
    }))
    .filter((registration) => registration.roster.length > 0)
    .sort((left, right) => left.teamName.localeCompare(right.teamName, "pt-BR"));

  if (registrations.length < 2) {
    throw new Response("Confirme duas equipes com elenco antes de criar o jogo.", { status: 409 });
  }

  return data(
    {
      competition,
      csrfToken: auth.payload.csrfToken,
      idempotencyKey: crypto.randomUUID(),
      registrations,
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);

  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const scheduledLocal = String(formData.get("scheduledLocal") ?? "");
  const venue = String(formData.get("venue") ?? "").trim();
  const rawGameNumber = String(formData.get("gameNumber") ?? "").trim();
  const periodCount = parseId(formData.get("periodCount"));
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)
  ) {
    return badRequest("A submissão expirou. Recarregue o editor.");
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledLocal)) {
    return badRequest("Informe data e hora válidas.");
  }
  if (!venue || venue.length > 160 || rawGameNumber.length > 40) {
    return badRequest("Revise local e número do jogo.");
  }
  if (!periodCount || periodCount < 4 || periodCount > 12) {
    return badRequest("A grade deve conter Q1–Q4 e somente OTs sequenciais.");
  }

  const registrationIds = {
    home: parseId(formData.get("homeRegistrationId")),
    away: parseId(formData.get("awayRegistrationId")),
  };
  if (
    !registrationIds.home ||
    !registrationIds.away ||
    registrationIds.home === registrationIds.away
  ) {
    return badRequest("Mandante e visitante devem ser equipes diferentes.");
  }

  const teams: TeamPayload[] = [];
  const activeSlots: Array<{ side: TeamSide; slotNumber: number; rosterEntryId: number }> = [];
  for (const side of ["home", "away"] as const) {
    const selectedPlayers = new Set<number>();
    const jerseys = new Set<string>();
    const teamSlots: TeamPayload["slots"] = [];
    for (let slotNumber = 1; slotNumber <= 12; slotNumber += 1) {
      const rosterEntryId = parseId(formData.get(`${side}Player${slotNumber}`));
      if (!rosterEntryId) continue;
      const jersey = normalizeJersey(String(formData.get(`${side}Jersey${slotNumber}`) ?? ""));
      if (!jersey.ok || jersey.value === null) return badRequest("Revise os números de camisa.");
      if (selectedPlayers.has(rosterEntryId) || jerseys.has(jersey.value)) {
        return badRequest("Não repita atleta ou camisa dentro da equipe.");
      }
      selectedPlayers.add(rosterEntryId);
      jerseys.add(jersey.value);
      teamSlots.push({ slotNumber, rosterEntryId, jerseyNumber: jersey.value });
      activeSlots.push({ side, slotNumber, rosterEntryId });
    }
    if (teamSlots.length === 0)
      return badRequest("Cada equipe precisa de ao menos um relacionado.");
    teams.push({ side, registrationId: registrationIds[side] as number, slots: teamSlots });
  }

  const periods: PeriodPayload[] = [];
  const foulsBySlot = new Map<string, FoulInput[]>();
  for (let periodNumber = 1; periodNumber <= periodCount; periodNumber += 1) {
    const stats = [];
    for (const slot of activeSlots) {
      const readStat = (field: string) => {
        const value = formData.get(`stat-${slot.side}-${slot.slotNumber}-${periodNumber}-${field}`);
        return value === null ? 0 : parseNonnegativeInteger(value);
      };
      const twoPointMade = readStat("two");
      const threePointMade = readStat("three");
      const freeThrowMade = readStat("free");
      const fouls = parseFoulCodes(
        formData.get(`stat-${slot.side}-${slot.slotNumber}-${periodNumber}-fouls`),
      );
      if (twoPointMade === null || threePointMade === null || freeThrowMade === null || !fouls) {
        return badRequest("Use apenas inteiros de 0 a 99 e códigos de falta válidos.");
      }
      stats.push({
        rosterEntryId: slot.rosterEntryId,
        twoPointMade,
        threePointMade,
        freeThrowMade,
        fouls,
      });
      const key = `${slot.side}-${slot.slotNumber}`;
      const accumulated = foulsBySlot.get(key) ?? [];
      fouls.forEach((code, index) => {
        accumulated.push({ periodNumber, sequenceNumber: index + 1, code });
      });
      foulsBySlot.set(key, accumulated);
    }
    periods.push({ periodNumber, stats });
  }

  for (const slot of activeSlots) {
    const disqualification = evaluateDisqualification(
      foulsBySlot.get(`${slot.side}-${slot.slotNumber}`) ?? [],
    );
    if (!disqualification) continue;
    for (const period of periods) {
      if (period.periodNumber <= disqualification.periodNumber) continue;
      const stat = period.stats.find((item) => item.rosterEntryId === slot.rosterEntryId);
      if (
        stat &&
        (stat.twoPointMade > 0 ||
          stat.threePointMade > 0 ||
          stat.freeThrowMade > 0 ||
          stat.fouls.length > 0)
      ) {
        return badRequest("Remova estatísticas e faltas posteriores à desqualificação por GD.");
      }
    }
  }

  const homeTeam = teams.find((team) => team.side === "home");
  const awayTeam = teams.find((team) => team.side === "away");
  if (!homeTeam || !awayTeam) return badRequest("Selecione mandante e visitante.");
  const homeRoster = new Set(homeTeam.slots.map((slot) => slot.rosterEntryId));
  const awayRoster = new Set(awayTeam.slots.map((slot) => slot.rosterEntryId));
  for (let checkpoint = 4; checkpoint < periodCount; checkpoint += 1) {
    const completed = periods.slice(0, checkpoint);
    if (deriveTeamScore(completed, homeRoster) !== deriveTeamScore(completed, awayRoster)) {
      return badRequest("Uma prorrogação só pode existir se o placar anterior estiver empatado.");
    }
  }
  if (deriveTeamScore(periods, homeRoster) === deriveTeamScore(periods, awayRoster)) {
    return badRequest("O jogo está empatado. Adicione uma prorrogação antes de encerrar.");
  }

  const payload: ManualScoresheetPayload = {
    idempotencyKey,
    competitionId,
    gameNumber: rawGameNumber || null,
    scheduledLocal,
    venue,
    teams: [homeTeam, awayTeam],
    periods,
  };
  const result = await auth.client.rpc("admin_create_manual_scoresheet", {
    p_payload: payload as unknown as Json,
  });
  if (result.error) {
    return data(
      { error: mapScoresheetError(result.error.code) },
      {
        status: result.error.code === "BD401" ? 403 : 400,
        headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
      },
    );
  }

  const competitionResult = await auth.client
    .from("competitions")
    .select("year,series_id,category_id")
    .eq("id", competitionId)
    .single();
  if (competitionResult.error) throw new Error("Manual scoresheet redirect context failed");
  const [seriesResult, categoryResult] = await Promise.all([
    auth.client
      .from("competition_series")
      .select("slug")
      .eq("id", competitionResult.data.series_id)
      .single(),
    auth.client
      .from("categories")
      .select("slug")
      .eq("id", competitionResult.data.category_id)
      .single(),
  ]);
  if (seriesResult.error || categoryResult.error) {
    throw new Error("Manual scoresheet redirect context failed");
  }

  throw redirect(
    `/${competitionResult.data.year}/${seriesResult.data.slug}/${categoryResult.data.slug}/games/${result.data}`,
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export default function NewManualScoresheet({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <ManualScoresheetEditor
      actionError={actionData?.error}
      competitionId={loaderData.competition.id}
      competitionName={loaderData.competition.display_name}
      csrfToken={loaderData.csrfToken}
      idempotencyKey={loaderData.idempotencyKey}
      registrations={loaderData.registrations}
    />
  );
}
