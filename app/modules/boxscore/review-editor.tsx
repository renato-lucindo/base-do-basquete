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

interface ReviewGame {
  id: number;
  gameNumber: string | null;
  scheduledAt: string | null;
  venue: string | null;
  homeRegistrationId: number;
  awayRegistrationId: number;
  homeTeamName: string;
  awayTeamName: string;
}

interface BoxscoreReviewEditorProps {
  actionError?: string;
  competitionId: number;
  competitionGender: string | null;
  csrfToken: string;
  games: ReviewGame[];
  review: { id: number; parsed: ParsedBoxscore; matches: ReviewMatch[] };
  registrations: ReviewRegistration[];
}

interface ReviewDraftData {
  gameId: number;
  step: number;
  registrations: Record<number, number>;
  resolutions: Record<number, string>;
}

type NewPlayerEligibilitySex = "" | "female" | "male";

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
  games,
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
  const initialGame =
    games.find((game) => game.gameNumber === review.parsed.gameNumber) ?? games[0] ?? null;
  const initialRegistrations = initialGame
    ? { 0: initialGame.homeRegistrationId, 1: initialGame.awayRegistrationId }
    : Object.fromEntries(
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
  const [gameId, setGameId] = useState(initialGame?.id ?? 0);
  const [teamRegistrations, setTeamRegistrations] =
    useState<Record<number, number>>(initialRegistrations);
  const [resolutions, setResolutions] = useState<Record<number, string>>(initialResolutions);
  const [newPlayerEligibility, setNewPlayerEligibility] = useState<
    Record<number, NewPlayerEligibilitySex>
  >({});
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
          { gameId, step, registrations: teamRegistrations, resolutions },
        ),
      );
      setPendingDraft(false);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [competitionId, gameId, pendingDraft, resolutions, review.id, step, teamRegistrations]);

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
  const pending = players.filter(
    (_, index) =>
      !resolutions[index] || (resolutions[index] === "new" && !newPlayerEligibility[index]),
  ).length;
  const missingTeams = review.parsed.teams.filter((_, index) => !teamRegistrations[index]).length;
  const hasTransientPrivateSelection = Object.values(newPlayerEligibility).some(Boolean);
  const editionGenderLabel =
    competitionGender === "male"
      ? "Masculino"
      : competitionGender === "female"
        ? "Feminino"
        : "Pendente de revisão";

  const restore = () => {
    if (!draft) return;
    if (
      !draft.data ||
      !Number.isInteger(draft.data.gameId) ||
      !draft.data.registrations ||
      !draft.data.resolutions
    ) {
      discard();
      setRestoreMessage("O rascunho incompatível foi descartado.");
      return;
    }
    const restoredGame = games.find((game) => game.id === draft.data.gameId);
    if (!restoredGame) {
      discard();
      setRestoreMessage("O jogo estrutural do rascunho não está mais disponível.");
      return;
    }
    const validRosterEntries = new Set(
      registrations.flatMap((registration) =>
        registration.roster.map(({ rosterEntryId }) => rosterEntryId),
      ),
    );
    let skipped = 0;
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
    setGameId(restoredGame.id);
    setTeamRegistrations({
      0: restoredGame.homeRegistrationId,
      1: restoredGame.awayRegistrationId,
    });
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
        <UnsavedChangesGuard active={pendingDraft || hasTransientPrivateSelection} />
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="importId" value={review.id} />
        <input type="hidden" name="gameId" value={gameId} />
        <input type="hidden" name="teamCount" value="2" />
        <input type="hidden" name="playerCount" value={players.length} />
        <section hidden={step !== 2}>
          <h2>Revisar jogo extraído</h2>
          <p>
            <strong>Jogo {review.parsed.gameNumber}</strong> · {review.parsed.teams[0].name}{" "}
            {review.parsed.teams[0].score} × {review.parsed.teams[1].score}{" "}
            {review.parsed.teams[1].name}
          </p>
          <label>
            Jogo estrutural
            <select
              value={gameId}
              required
              onChange={(event) => {
                const selectedId = Number(event.currentTarget.value);
                const game = games.find((candidate) => candidate.id === selectedId);
                if (!game) return;
                setGameId(game.id);
                setTeamRegistrations({
                  0: game.homeRegistrationId,
                  1: game.awayRegistrationId,
                });
                setResolutions({});
                change();
              }}
            >
              <option value="" disabled>
                Selecione o jogo
              </option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.gameNumber ? `Jogo ${game.gameNumber}` : `Jogo #${game.id}`} ·{" "}
                  {game.homeTeamName} × {game.awayTeamName}
                </option>
              ))}
            </select>
          </label>
          <div className="boxscore-team-resolution">
            {review.parsed.teams.map((team, index) => (
              <label key={team.name}>
                {team.name} ({team.abbreviation})
                <input type="hidden" name={`teamName-${index}`} value={team.name} />
                <select value={teamRegistrations[index] || ""} disabled>
                  <option value="" disabled>
                    Selecione a inscrição
                  </option>
                  {registrations.map((registration) => (
                    <option key={registration.id} value={registration.id}>
                      {registration.teamName}
                    </option>
                  ))}
                </select>
                <input
                  type="hidden"
                  name={`registration-${index}`}
                  value={teamRegistrations[index] || ""}
                />
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
                        const nextResolution = event.currentTarget.value;
                        setResolutions((current) => ({
                          ...current,
                          [index]: nextResolution,
                        }));
                        if (nextResolution !== "new") {
                          setNewPlayerEligibility((current) => {
                            const next = { ...current };
                            delete next[index];
                            return next;
                          });
                        }
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
                      <option value="new">
                        Criar automaticamente pelo nome extraído após revisão
                      </option>
                    </select>
                    <InlineFieldError
                      message={attempted && !value ? "Revise esta associação." : null}
                    />
                  </label>
                  {value === "new" ? (
                    <label>
                      Sexo para elegibilidade
                      <select
                        name={`playerEligibilitySex-${index}`}
                        value={newPlayerEligibility[index] ?? ""}
                        required
                        aria-invalid={(attempted && !newPlayerEligibility[index]) || undefined}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;
                          if (nextValue !== "female" && nextValue !== "male") return;
                          setNewPlayerEligibility((current) => ({
                            ...current,
                            [index]: nextValue,
                          }));
                        }}
                      >
                        <option value="" disabled>
                          Selecione sem inferir
                        </option>
                        <option value="female">Feminino</option>
                        <option value="male">Masculino</option>
                      </select>
                      <small>
                        Naipe da edição: {editionGenderLabel}. Esta escolha privada não é salva no
                        rascunho.
                      </small>
                      <InlineFieldError
                        message={
                          attempted && !newPlayerEligibility[index]
                            ? "Selecione explicitamente para criar o atleta."
                            : null
                        }
                      />
                    </label>
                  ) : null}
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
            hasTransientPrivateSelection
              ? "Seleção privada não salva"
              : pendingDraft
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
