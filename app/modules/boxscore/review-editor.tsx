import { useEffect, useMemo, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import { AdminDraftNotice } from "../../components/admin/admin-draft-notice";
import { AdminPlayerSearch } from "../../components/admin/admin-player-search";
import { AdminWizardSteps } from "../../components/admin/admin-wizard-steps";
import { InlineFieldError } from "../../components/admin/inline-field-error";
import { StickyActionSummary } from "../../components/admin/sticky-action-summary";
import { UnsavedChangesGuard } from "../../components/admin/unsaved-changes-guard";
import type { AdminPlayerSearchResult } from "../players/admin-domain";
import { readAdminDraft, removeAdminDraft, saveAdminDraft } from "../admin-drafts/client";
import type { AdminDraft } from "../admin-drafts/schema";
import type { ParsedBoxscore } from "./types";
import type { Json } from "../../types/database.generated";

const importSteps = ["Arquivo", "Revisão", "Associações", "Confirmação"] as const;

interface ReviewMatch {
  source_team_name: string;
  source_player_name: string;
  source_jersey_number: string;
  roster_entry_id: number | null;
  suggested_player_id: number | null;
  suggestion_payload: Json;
  suggestion_kind: string;
  similarity_score: number | null;
}

interface ReviewRegistration {
  id: number;
  teamId: number;
  teamName: string;
  abbreviation: string | null;
  roster: Array<{
    rosterEntryId: number;
    playerId: number;
    playerName: string;
    jerseyNumber: string | null;
  }>;
}

interface BoxscoreReviewEditorProps {
  actionError?: string;
  competitionId: number;
  competitionGender: string | null;
  csrfToken: string;
  review: { id: number; parsed: ParsedBoxscore; matches: ReviewMatch[] };
  registrations: ReviewRegistration[];
}

interface ReviewDraftData {
  step: number;
  registrations: Record<number, number>;
  resolutions: Record<number, string>;
}

function normalizeTeam(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function BoxscoreReviewEditor({
  actionError,
  competitionId,
  competitionGender,
  csrfToken,
  review,
  registrations,
}: BoxscoreReviewEditorProps) {
  const navigation = useNavigation();
  const submitted = useRef(false);
  const matches = useMemo(
    () =>
      new Map(
        review.matches.map((match) => [
          `${match.source_team_name}\u0000${match.source_player_name}`,
          match,
        ]),
      ),
    [review.matches],
  );
  const players = useMemo(
    () => review.parsed.teams.flatMap((team) => team.players.map((player) => ({ team, player }))),
    [review.parsed.teams],
  );
  const matchedRegistration = (team: ParsedBoxscore["teams"][number]) =>
    registrations.find(
      (registration) =>
        normalizeTeam(registration.teamName) === normalizeTeam(team.name) ||
        registration.abbreviation?.toUpperCase() === team.abbreviation,
    );
  const rosteredPlayerIds = useMemo(
    () => new Set(registrations.flatMap((item) => item.roster.map((entry) => entry.playerId))),
    [registrations],
  );
  const initialRegistrations = Object.fromEntries(
    review.parsed.teams.map((team, index) => [index, matchedRegistration(team)?.id ?? 0]),
  );
  const initialResolutions = Object.fromEntries(
    players.map(({ team, player }, index) => {
      const match = matches.get(`${team.name}\u0000${player.name}`);
      const selectedTeam = matchedRegistration(team);
      const suggestedRoster = match?.roster_entry_id
        ? selectedTeam?.roster.find((entry) => entry.rosterEntryId === match.roster_entry_id)
        : null;
      const suggestedFree = match?.suggested_player_id
        ? !rosteredPlayerIds.has(match.suggested_player_id)
        : false;
      const value =
        match?.suggestion_kind === "exact" && suggestedRoster
          ? `roster:${suggestedRoster.rosterEntryId}`
          : match?.suggestion_kind === "exact" && suggestedFree
            ? `player:${match.suggested_player_id}`
            : match?.suggestion_kind === "unmatched"
              ? "new"
              : "";
      return [index, value];
    }),
  );
  const [step, setStep] = useState(2);
  const [teamRegistrations, setTeamRegistrations] =
    useState<Record<number, number>>(initialRegistrations);
  const [resolutions, setResolutions] = useState<Record<number, string>>(initialResolutions);
  const [draft, setDraft] = useState<AdminDraft<ReviewDraftData> | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  useEffect(() => {
    const result = readAdminDraft<ReviewDraftData>({
      flow: "boxscore-review",
      competitionId,
      entityId: review.id,
    });
    if (result.status === "available") setDraft(result.draft);
  }, [competitionId, review.id]);

  useEffect(() => {
    if (!pendingDraft) return;
    const timeout = window.setTimeout(() => {
      setSavedAt(
        saveAdminDraft(
          { flow: "boxscore-review", competitionId, entityId: review.id },
          { step, registrations: teamRegistrations, resolutions },
        ),
      );
      setPendingDraft(false);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [competitionId, pendingDraft, resolutions, review.id, step, teamRegistrations]);

  useEffect(() => {
    if (navigation.state === "submitting" && navigation.formAction?.includes("mode=confirm")) {
      submitted.current = true;
    }
  }, [navigation.formAction, navigation.state]);

  useEffect(
    () => () => {
      if (submitted.current) {
        removeAdminDraft({ flow: "boxscore-review", competitionId, entityId: review.id });
      }
    },
    [competitionId, review.id],
  );

  const change = () => setPendingDraft(true);
  const pending = players.filter((_, index) => !resolutions[index]).length;
  const missingTeams = review.parsed.teams.filter((_, index) => !teamRegistrations[index]).length;

  const restore = () => {
    if (!draft) return;
    if (!draft.data || !draft.data.registrations || !draft.data.resolutions) {
      discard();
      setRestoreMessage("O rascunho incompatível foi descartado.");
      return;
    }
    const validRegistrations = new Set(registrations.map(({ id }) => id));
    const validRosterEntries = new Set(
      registrations.flatMap((registration) =>
        registration.roster.map(({ rosterEntryId }) => rosterEntryId),
      ),
    );
    let skipped = 0;
    const restoredRegistrations = Object.fromEntries(
      Object.entries(draft.data.registrations).map(([index, registrationId]) => {
        if (validRegistrations.has(registrationId)) return [index, registrationId];
        skipped += 1;
        return [index, 0];
      }),
    );
    const restoredResolutions = Object.fromEntries(
      Object.entries(draft.data.resolutions).map(([index, resolution]) => {
        if (resolution === "new") return [index, resolution];
        const rosterMatch = resolution.match(/^roster:([1-9][0-9]*)$/);
        const playerMatch = resolution.match(/^player:([1-9][0-9]*)$/);
        if (playerMatch || (rosterMatch && validRosterEntries.has(Number(rosterMatch[1])))) {
          return [index, resolution];
        }
        skipped += 1;
        return [index, ""];
      }),
    );
    setStep(Math.min(4, Math.max(2, draft.data.step)));
    setTeamRegistrations(restoredRegistrations);
    setResolutions(restoredResolutions);
    setSavedAt(draft.savedAt);
    setDraft(null);
    setRestoreMessage(
      skipped
        ? `${skipped} referência(s) indisponível(is) foram ignoradas.`
        : "Rascunho restaurado.",
    );
  };

  const discard = () => {
    removeAdminDraft({ flow: "boxscore-review", competitionId, entityId: review.id });
    setDraft(null);
    setSavedAt(null);
  };

  return (
    <section className="admin-panel boxscore-review">
      <AdminWizardSteps current={step} labels={importSteps} onSelect={setStep} />
      {draft ? (
        <AdminDraftNotice savedAt={draft.savedAt} onRestore={restore} onDiscard={discard} />
      ) : null}
      {restoreMessage ? <output className="admin-note">{restoreMessage}</output> : null}
      <Form method="post" action="?mode=confirm" onSubmit={() => setAttempted(true)}>
        <UnsavedChangesGuard active={pendingDraft} />
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="importId" value={review.id} />
        <input type="hidden" name="teamCount" value="2" />
        <input type="hidden" name="playerCount" value={players.length} />
        <section hidden={step !== 2}>
          <h2>Revisar jogo extraído</h2>
          <p>
            <strong>Jogo {review.parsed.gameNumber}</strong> · {review.parsed.teams[0].name}{" "}
            {review.parsed.teams[0].score} × {review.parsed.teams[1].score}{" "}
            {review.parsed.teams[1].name}
          </p>
          <div className="boxscore-team-resolution">
            {review.parsed.teams.map((team, index) => (
              <label key={team.name}>
                {team.name} ({team.abbreviation})
                <input type="hidden" name={`teamName-${index}`} value={team.name} />
                <select
                  name={`registration-${index}`}
                  value={teamRegistrations[index] || ""}
                  required
                  onChange={(event) => {
                    setTeamRegistrations((current) => ({
                      ...current,
                      [index]: Number(event.currentTarget.value),
                    }));
                    change();
                  }}
                >
                  <option value="" disabled>
                    Selecione a inscrição
                  </option>
                  {registrations.map((registration) => (
                    <option key={registration.id} value={registration.id}>
                      {registration.teamName}
                    </option>
                  ))}
                </select>
                <InlineFieldError
                  message={
                    attempted && !teamRegistrations[index] ? "Selecione uma inscrição." : null
                  }
                />
              </label>
            ))}
          </div>
          <div className="wizard-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={missingTeams > 0}
              onClick={() => {
                setStep(3);
                change();
              }}
            >
              Revisar associações
            </button>
          </div>
        </section>

        <section hidden={step !== 3}>
          <h2>Associar atletas</h2>
          <p>{pending} associação(ões) pendente(s). Correspondências sugeridas exigem revisão.</p>
          <div className="boxscore-association-list">
            {players.map(({ team, player }, index) => {
              const match = matches.get(`${team.name}\u0000${player.name}`);
              const selectedTeam = registrations.find(
                (registration) =>
                  registration.id === teamRegistrations[review.parsed.teams.indexOf(team)],
              );
              const suggestions = Array.isArray(match?.suggestion_payload)
                ? (match.suggestion_payload as Array<{
                    playerName?: string;
                    score?: number;
                    teamName?: string | null;
                  }>)
                : [];
              const value = resolutions[index] ?? "";
              const selectedPlayerId = value.startsWith("player:") ? Number(value.slice(7)) : null;
              return (
                <article key={`${team.name}-${player.jerseyNumber}-${player.name}`}>
                  <header>
                    <span>
                      <strong>
                        #{player.jerseyNumber} · {player.name}
                      </strong>
                      <small>
                        {team.name}
                        {player.didNotPlay ? " · NJ" : ""}
                      </small>
                    </span>
                    <span className={`match-pill match-${match?.suggestion_kind ?? "unmatched"}`}>
                      {match?.suggestion_kind === "exact"
                        ? "Exata"
                        : match?.suggestion_kind === "similar"
                          ? "Sugerida"
                          : "Pendente"}
                    </span>
                  </header>
                  <input type="hidden" name={`playerTeam-${index}`} value={team.name} />
                  <input type="hidden" name={`playerName-${index}`} value={player.name} />
                  <label>
                    Associação
                    <select
                      name={`playerResolution-${index}`}
                      value={value}
                      required
                      aria-invalid={(attempted && !value) || undefined}
                      onChange={(event) => {
                        setResolutions((current) => ({
                          ...current,
                          [index]: event.currentTarget.value,
                        }));
                        change();
                      }}
                    >
                      <option value="" disabled>
                        Selecione o atleta
                      </option>
                      {registrations.flatMap((registration) =>
                        registration.roster.map((candidate) => (
                          <option
                            key={candidate.rosterEntryId}
                            value={`roster:${candidate.rosterEntryId}`}
                          >
                            {registration.teamName} · {candidate.playerName} · #
                            {candidate.jerseyNumber ?? "—"}
                          </option>
                        )),
                      )}
                      {selectedPlayerId ? (
                        <option value={value}>
                          Adicionar cadastro #{selectedPlayerId} ao elenco
                        </option>
                      ) : null}
                      <option value="new">Criar automaticamente pelo nome extraído</option>
                    </select>
                    <InlineFieldError
                      message={attempted && !value ? "Revise esta associação." : null}
                    />
                  </label>
                  {suggestions.length ? (
                    <p className="match-suggestions">
                      Sugestões:{" "}
                      {suggestions
                        .map(
                          (item) =>
                            `${item.playerName ?? "Atleta"} (${Math.round((item.score ?? 0) * 100)}%)`,
                        )
                        .join("; ")}
                    </p>
                  ) : null}
                  <details>
                    <summary>Pesquisar outro atleta</summary>
                    <AdminPlayerSearch
                      competitionId={competitionId}
                      competitionGender={competitionGender}
                      registrationId={selectedTeam?.id}
                      csrfToken={csrfToken}
                      selectedIds={selectedPlayerId ? new Set([selectedPlayerId]) : undefined}
                      onSelect={(candidate: AdminPlayerSearchResult) => {
                        setResolutions((current) => ({
                          ...current,
                          [index]: `player:${candidate.id}`,
                        }));
                        change();
                      }}
                    />
                  </details>
                </article>
              );
            })}
          </div>
          <div className="wizard-actions">
            <button className="button button-ghost" type="button" onClick={() => setStep(2)}>
              Voltar
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={pending > 0}
              onClick={() => {
                setStep(4);
                change();
              }}
            >
              Revisar confirmação
            </button>
          </div>
        </section>

        <section hidden={step !== 4} className="boxscore-confirmation">
          <h2>Confirmar importação</h2>
          <p>
            Serão confirmadas 2 equipes e {players.length} associações. O commit permanece atômico e
            o PDF continua privado.
          </p>
          {actionError ? <p className="form-error">{actionError}</p> : null}
          <label className="confirmation-check">
            <input type="checkbox" name="confirmImport" value="yes" required />
            Confirmo que revisei as equipes, atletas e correspondências sugeridas.
          </label>
          <div className="wizard-actions">
            <button className="button button-ghost" type="button" onClick={() => setStep(3)}>
              Voltar
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={navigation.state !== "idle" || pending > 0}
            >
              {navigation.state !== "idle" ? "Confirmando…" : "Confirmar importação atômica"}
            </button>
          </div>
        </section>

        <StickyActionSummary
          title={`Importação #${review.id}`}
          metrics={[
            { label: "Atletas", value: players.length },
            { label: "Pendências", value: pending + missingTeams },
          ]}
          status={
            pendingDraft
              ? "Salvando rascunho…"
              : savedAt
                ? "Rascunho salvo"
                : "Revisão em andamento"
          }
        >
          {step < 4 ? (
            <button
              className="button button-primary"
              type="button"
              disabled={(step === 2 && missingTeams > 0) || (step === 3 && pending > 0)}
              onClick={() => {
                setStep(Math.min(4, step + 1));
                change();
              }}
            >
              Próxima etapa
            </button>
          ) : null}
        </StickyActionSummary>
      </Form>
    </section>
  );
}
