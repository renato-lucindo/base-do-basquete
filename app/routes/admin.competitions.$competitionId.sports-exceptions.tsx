import { data, Form, Link, redirect, useNavigation } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  parseAmendmentImpact,
  parseDecisionImpact,
  parseGroupClosurePreview,
  parseSportsExceptionsDashboard,
  sportsExceptionError,
  validateAmendmentInput,
  validateDecisionInput,
  validateGroupOrder,
  type AmendmentImpact,
  type DecisionImpact,
  type DecisionType,
  type GroupClosurePreview,
} from "../modules/competition/sports-exceptions";
import type { Route } from "./+types/admin.competitions.$competitionId.sports-exceptions";

type ActionData =
  | {
      error: string;
      preview?: undefined;
    }
  | {
      error?: undefined;
      preview: {
        kind: "decision";
        requestId: string;
        impact: DecisionImpact;
        decisionType: DecisionType;
        reason: string;
      };
    }
  | {
      error?: undefined;
      preview: {
        kind: "amendment";
        requestId: string;
        impact: AmendmentImpact;
        reason: string;
      };
    }
  | {
      error?: undefined;
      preview: {
        kind: "group";
        requestId: string;
        impact: GroupClosurePreview;
      };
    };

function positiveId(value: unknown): number | null {
  const text = typeof value === "string" ? value : "";
  if (!/^[1-9][0-9]*$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function meta() {
  return [{ title: "Exceções esportivas — Administração" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const competitionId = positiveId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const [competition, dashboardResult, registrations, teams] = await Promise.all([
    auth.client
      .from("competitions")
      .select("id,display_name,status")
      .eq("id", competitionId)
      .maybeSingle(),
    auth.client.rpc("admin_get_sports_exceptions_dashboard", {
      p_competition_id: competitionId,
    }),
    auth.client
      .from("team_registrations")
      .select("id,team_id,status")
      .eq("competition_id", competitionId),
    auth.client.from("teams").select("id,name"),
  ]);
  if (competition.error || !competition.data)
    throw new Response("Edição não encontrada", { status: 404 });
  const dashboard = parseSportsExceptionsDashboard(dashboardResult.data);
  if (dashboardResult.error || !dashboard || registrations.error || teams.error)
    throw new Response("Exceções esportivas indisponíveis.", { status: 503 });
  const teamNames = new Map(teams.data.map((team) => [team.id, team.name]));
  const registrationNames = Object.fromEntries(
    registrations.data.map((registration) => [
      registration.id,
      teamNames.get(registration.team_id) ?? `Inscrição #${registration.id}`,
    ]),
  );
  return data(
    {
      competition: competition.data,
      dashboard,
      registrationNames,
      csrfToken: auth.payload.csrfToken,
      saved: new URL(request.url).searchParams.get("saved"),
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const competitionId = positiveId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const form = await request.formData();
  assertCsrfToken(form, auth.payload.csrfToken);
  const headers = auth.cookie ? { "Set-Cookie": auth.cookie } : undefined;
  const intent = form.get("intent");

  if (intent === "preview-decision" || intent === "confirm-decision") {
    const parsed = validateDecisionInput(form, intent === "confirm-decision");
    if (!parsed.ok)
      return data<ActionData>(
        { error: "Revise participantes, tipo e justificativa." },
        { status: 400, headers },
      );
    if (intent === "preview-decision") {
      const result = await auth.client.rpc("admin_get_matchup_administrative_impact", {
        p_matchup_id: parsed.input.matchupId,
        p_winner_registration_id: parsed.input.winnerRegistrationId,
      });
      const impact = parseDecisionImpact(result.data);
      if (result.error || !impact)
        return data<ActionData>(
          { error: sportsExceptionError(result.error?.code) },
          { status: 400, headers },
        );
      return data<ActionData>(
        {
          preview: {
            kind: "decision",
            requestId: crypto.randomUUID(),
            impact,
            decisionType: parsed.input.decisionType,
            reason: parsed.input.reason,
          },
        },
        { headers },
      );
    }
    if (!parsed.input.requestId) throw new Response("Solicitação inválida", { status: 400 });
    const result = await auth.client.rpc("admin_resolve_matchup_administratively", {
      p_request_id: parsed.input.requestId,
      p_matchup_id: parsed.input.matchupId,
      p_expected_home_registration_id: parsed.input.homeRegistrationId,
      p_expected_away_registration_id: parsed.input.awayRegistrationId,
      p_winner_registration_id: parsed.input.winnerRegistrationId,
      p_decision_type: parsed.input.decisionType,
      p_reason: parsed.input.reason,
    });
    if (result.error)
      return data<ActionData>(
        { error: sportsExceptionError(result.error.code) },
        { status: 400, headers },
      );
    throw redirect(`/admin/competitions/${competitionId}/sports-exceptions?saved=decision`, {
      headers,
    });
  }

  if (intent === "preview-amendment" || intent === "confirm-amendment") {
    const parsed = validateAmendmentInput(form, intent === "confirm-amendment");
    if (!parsed.ok)
      return data<ActionData>(
        { error: "Revise o resultado corrigido e a justificativa." },
        { status: 400, headers },
      );
    if (intent === "preview-amendment") {
      const result = await auth.client.rpc("admin_get_ruleset_amendment_impact", {
        p_matchup_id: parsed.input.matchupId,
        p_corrected_winner_registration_id: parsed.input.correctedWinnerRegistrationId,
      });
      const impact = parseAmendmentImpact(result.data);
      if (result.error || !impact)
        return data<ActionData>(
          { error: sportsExceptionError(result.error?.code) },
          { status: 400, headers },
        );
      return data<ActionData>(
        {
          preview: {
            kind: "amendment",
            requestId: crypto.randomUUID(),
            impact,
            reason: parsed.input.reason,
          },
        },
        { headers },
      );
    }
    if (!parsed.input.requestId) throw new Response("Solicitação inválida", { status: 400 });
    const result = await auth.client.rpc("admin_amend_matchup_outcome", {
      p_request_id: parsed.input.requestId,
      p_matchup_id: parsed.input.matchupId,
      p_expected_winner_registration_id: parsed.input.expectedWinnerRegistrationId,
      p_corrected_winner_registration_id: parsed.input.correctedWinnerRegistrationId,
      p_reason: parsed.input.reason,
    });
    if (result.error)
      return data<ActionData>(
        { error: sportsExceptionError(result.error.code) },
        { status: 400, headers },
      );
    throw redirect(`/admin/competitions/${competitionId}/sports-exceptions?saved=amendment`, {
      headers,
    });
  }

  if (intent === "preview-group") {
    const groupId = positiveId(form.get("groupId"));
    if (!groupId)
      return data<ActionData>({ error: "Selecione novamente o grupo." }, { status: 400, headers });
    const result = await auth.client.rpc("admin_get_group_closure_preview", {
      p_group_id: groupId,
    });
    const impact = parseGroupClosurePreview(result.data);
    if (result.error || !impact)
      return data<ActionData>(
        { error: sportsExceptionError(result.error?.code) },
        { status: 400, headers },
      );
    return data<ActionData>(
      {
        preview: { kind: "group", requestId: crypto.randomUUID(), impact },
      },
      { headers },
    );
  }

  if (intent === "confirm-group") {
    const parsed = validateGroupOrder(form);
    if (!parsed.ok)
      return data<ActionData>(
        { error: "Revise a ordem final, o desempate e a confirmação." },
        { status: 400, headers },
      );
    const result = await auth.client.rpc("admin_close_competition_group", {
      p_request_id: parsed.input.requestId,
      p_group_id: parsed.input.groupId,
      p_expected_source_hash: parsed.input.sourceHash,
      p_ordered_registration_ids: parsed.input.orderedRegistrationIds,
      p_tie_break_reason: parsed.input.tieBreakReason ?? "",
      p_advancement_targets: [],
    });
    if (result.error)
      return data<ActionData>(
        { error: sportsExceptionError(result.error.code) },
        { status: 400, headers },
      );
    throw redirect(`/admin/competitions/${competitionId}/sports-exceptions?saved=group`, {
      headers,
    });
  }
  throw new Response("Ação inválida", { status: 400 });
}

export default function SportsExceptionsPage({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  const name = (id: number | null) =>
    id ? (loaderData.registrationNames[String(id)] ?? `Inscrição #${id}`) : "Vaga pendente";
  const unresolved = loaderData.dashboard.matchups.filter(
    (matchup) => !matchup.outcome && matchup.homeRegistrationId && matchup.awayRegistrationId,
  );
  const resolved = loaderData.dashboard.matchups.filter((matchup) => matchup.outcome);
  const preview = actionData && "preview" in actionData ? actionData.preview : undefined;
  return (
    <AdminArea title={`Exceções esportivas — ${loaderData.competition.display_name}`}>
      <Link to={`/admin/competitions/${loaderData.competition.id}`}>Voltar ao hub</Link>
      <p>
        Ações secundárias e irreversíveis. Gere a prévia, revise o impacto calculado no banco e só
        então confirme. Nenhuma operação cria placar ou publica a edição.
      </p>
      {loaderData.saved ? <p className="form-success">Operação esportiva registrada.</p> : null}
      {actionData && "error" in actionData && actionData.error ? (
        <p className="form-error" role="alert">
          {actionData.error}
        </p>
      ) : null}

      <section className="admin-panel">
        <p className="eyebrow">Encerramento de grupo</p>
        <h2>Classificatória final</h2>
        {loaderData.dashboard.groups.length ? (
          loaderData.dashboard.groups.map((group) => (
            <div className="admin-form" key={group.id}>
              <h3>{group.code}</h3>
              {group.closed ? (
                <p>Grupo encerrado. Snapshot #{group.closureId} preservado.</p>
              ) : (
                <Form method="post">
                  <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
                  <input type="hidden" name="intent" value="preview-group" />
                  <input type="hidden" name="groupId" value={group.id} />
                  <button className="button button-secondary" type="submit" disabled={busy}>
                    Gerar prévia da classificação final
                  </button>
                </Form>
              )}
            </div>
          ))
        ) : (
          <p>Esta revisão eliminatória não possui grupos para encerrar.</p>
        )}
      </section>

      <section className="admin-panel">
        <p className="eyebrow">Sem placar fictício</p>
        <h2>W.O., desistência ou decisão administrativa</h2>
        {unresolved.length ? (
          unresolved.map((matchup) => (
            <Form method="post" className="admin-form" key={matchup.id}>
              <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
              <input type="hidden" name="intent" value="preview-decision" />
              <input type="hidden" name="matchupId" value={matchup.id} />
              <input
                type="hidden"
                name="homeRegistrationId"
                value={matchup.homeRegistrationId ?? ""}
              />
              <input
                type="hidden"
                name="awayRegistrationId"
                value={matchup.awayRegistrationId ?? ""}
              />
              <h3>
                {matchup.round} — {matchup.code}
              </h3>
              <p>
                {name(matchup.homeRegistrationId)} × {name(matchup.awayRegistrationId)}
              </p>
              <label>
                Tipo
                <select name="decisionType" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  <option value="walkover">W.O.</option>
                  <option value="withdrawal">Desistência</option>
                  <option value="administrative_decision">Decisão administrativa</option>
                </select>
              </label>
              <label>
                Vencedor
                <select name="winnerRegistrationId" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  <option value={matchup.homeRegistrationId ?? ""}>
                    {name(matchup.homeRegistrationId)}
                  </option>
                  <option value={matchup.awayRegistrationId ?? ""}>
                    {name(matchup.awayRegistrationId)}
                  </option>
                </select>
              </label>
              <label>
                Justificativa
                <textarea name="reason" required minLength={10} maxLength={500} rows={3} />
              </label>
              <button className="button button-secondary" type="submit" disabled={busy}>
                Revisar impacto da decisão
              </button>
            </Form>
          ))
        ) : (
          <p>Não há confronto com duas equipes pendente de resolução.</p>
        )}
      </section>

      <section className="admin-panel">
        <p className="eyebrow">Revisão versionada</p>
        <h2>Corrigir vencedor antes do ponto de corte</h2>
        {resolved.length ? (
          resolved.map((matchup) => (
            <Form method="post" className="admin-form" key={matchup.id}>
              <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
              <input type="hidden" name="intent" value="preview-amendment" />
              <input type="hidden" name="matchupId" value={matchup.id} />
              <input
                type="hidden"
                name="expectedWinnerRegistrationId"
                value={matchup.outcome?.winnerRegistrationId ?? ""}
              />
              <input
                type="hidden"
                name="correctedWinnerRegistrationId"
                value={matchup.outcome?.loserRegistrationId ?? ""}
              />
              <h3>
                {matchup.round} — {matchup.code}
              </h3>
              <p>
                Atual: {name(matchup.outcome?.winnerRegistrationId ?? null)}. Correção proposta:{" "}
                {name(matchup.outcome?.loserRegistrationId ?? null)}.
              </p>
              <label>
                Justificativa da correção
                <textarea name="reason" required minLength={10} maxLength={500} rows={3} />
              </label>
              <button className="button button-secondary" type="submit" disabled={busy}>
                Revisar ponto de corte e impacto
              </button>
            </Form>
          ))
        ) : (
          <p>Nenhum resultado resolvido admite prévia de correção.</p>
        )}
      </section>

      {preview?.kind === "decision" ? (
        <section className="admin-panel admin-danger-zone" id="confirm-operation">
          <h2>Confirmar decisão sem placar</h2>
          <p>
            Vencedor: {name(preview.impact.winnerRegistrationId)}. Perdedor:{" "}
            {name(preview.impact.loserRegistrationId)}. Vagas futuras afetadas:{" "}
            {preview.impact.dependentSlots}.{" "}
            {preview.impact.game
              ? `O jogo #${preview.impact.game.id} será cancelado e preservado.`
              : "Nenhum jogo será criado."}
          </p>
          <Form method="post" className="admin-form">
            <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
            <input type="hidden" name="intent" value="confirm-decision" />
            <input type="hidden" name="requestId" value={preview.requestId} />
            <input type="hidden" name="matchupId" value={preview.impact.matchupId} />
            <input
              type="hidden"
              name="homeRegistrationId"
              value={preview.impact.homeRegistrationId}
            />
            <input
              type="hidden"
              name="awayRegistrationId"
              value={preview.impact.awayRegistrationId}
            />
            <input
              type="hidden"
              name="winnerRegistrationId"
              value={preview.impact.winnerRegistrationId}
            />
            <input type="hidden" name="decisionType" value={preview.decisionType} />
            <input type="hidden" name="reason" value={preview.reason} />
            <label className="checkbox-label">
              <input name="confirmed" type="checkbox" required />
              Confirmo a decisão e a preservação do histórico.
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={busy || preview.impact.alreadyResolved}
            >
              Confirmar decisão
            </button>
          </Form>
        </section>
      ) : null}

      {preview?.kind === "amendment" ? (
        <section className="admin-panel admin-danger-zone" id="confirm-operation">
          <h2>Confirmar nova revisão</h2>
          <p>
            {preview.impact.canAmend
              ? "Ponto de corte ainda não atingido."
              : "Bloqueado: um dependente já começou ou recebeu dados."}{" "}
            A revisão atual será preservada como superseded.
          </p>
          <p>
            Antes: {name(preview.impact.before.winnerRegistrationId)}. Depois:{" "}
            {name(preview.impact.after.winnerRegistrationId)}. Dependências:{" "}
            {preview.impact.dependents.length}.
          </p>
          <Form method="post" className="admin-form">
            <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
            <input type="hidden" name="intent" value="confirm-amendment" />
            <input type="hidden" name="requestId" value={preview.requestId} />
            <input type="hidden" name="matchupId" value={preview.impact.matchupId} />
            <input
              type="hidden"
              name="expectedWinnerRegistrationId"
              value={preview.impact.before.winnerRegistrationId}
            />
            <input
              type="hidden"
              name="correctedWinnerRegistrationId"
              value={preview.impact.after.winnerRegistrationId}
            />
            <input type="hidden" name="reason" value={preview.reason} />
            <label className="checkbox-label">
              <input name="confirmed" type="checkbox" required />
              Confirmo o clone, a supersessão e o recálculo apenas do futuro.
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={busy || !preview.impact.canAmend}
            >
              Ativar revisão corrigida
            </button>
          </Form>
        </section>
      ) : null}

      {preview?.kind === "group" ? (
        <section className="admin-panel admin-danger-zone" id="confirm-operation">
          <h2>Confirmar snapshot final do grupo</h2>
          <p>
            {preview.impact.eligible
              ? "Todos os confrontos possuem autoridade válida."
              : `Ainda há ${preview.impact.invalidMatchupIds.length} confronto(s) inválido(s).`}
          </p>
          <Form method="post" className="admin-form">
            <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
            <input type="hidden" name="intent" value="confirm-group" />
            <input type="hidden" name="requestId" value={preview.requestId} />
            <input type="hidden" name="groupId" value={preview.impact.groupId} />
            <input type="hidden" name="sourceHash" value={preview.impact.sourceHash} />
            {preview.impact.standings.map((standing, index) => (
              <div className="inline-admin-form" key={standing.registrationId}>
                <input type="hidden" name="registrationId" value={standing.registrationId} />
                <label>
                  Posição de {name(standing.registrationId)}
                  <input
                    name="position"
                    type="number"
                    min={1}
                    max={preview.impact.standings.length}
                    defaultValue={index + 1}
                    required
                  />
                </label>
                <span>
                  {standing.wins} vitórias · saldo {standing.pointDifference}
                </span>
              </div>
            ))}
            <label>
              Critério de desempate, quando aplicável
              <textarea name="tieBreakReason" maxLength={500} rows={3} />
            </label>
            <label className="checkbox-label">
              <input name="confirmed" type="checkbox" required />
              Confirmo a ordem e o snapshot imutável.
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={busy || !preview.impact.eligible || preview.impact.closed}
            >
              Encerrar grupo
            </button>
          </Form>
        </section>
      ) : null}
    </AdminArea>
  );
}
