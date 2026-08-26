import { useEffect, useMemo, useState } from "react";
import { Form, useNavigation } from "react-router";

import {
  readAdminDraft,
  removeAdminDraft,
  saveAdminDraft,
} from "../../modules/admin-drafts/client";
import type { AdminDraft } from "../../modules/admin-drafts/schema";
import type { AdminPlayerSearchResult } from "../../modules/players/admin-domain";
import { AdminDraftNotice } from "./admin-draft-notice";
import { AdminPlayerSearch } from "./admin-player-search";
import { InlineFieldError } from "./inline-field-error";
import { StickyActionSummary } from "./sticky-action-summary";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

interface RosterPlayer extends AdminPlayerSearchResult {
  jerseyNumber: string;
}

interface RosterDraftData {
  entries: Array<{ playerId: number; jerseyNumber: string }>;
}

interface RosterEditorProps {
  competitionId: number;
  csrfToken: string;
  registrationId: number;
  teamName: string;
  currentRoster: RosterPlayer[];
  suggestedRoster: RosterPlayer[];
  suggestionLabel?: string | null;
  saved: boolean;
}

function playerMap(players: RosterPlayer[]) {
  return new Map(players.map((player) => [player.id, player]));
}

export function RosterEditor({
  competitionId,
  csrfToken,
  registrationId,
  teamName,
  currentRoster,
  suggestedRoster,
  suggestionLabel,
  saved,
}: RosterEditorProps) {
  const navigation = useNavigation();
  const knownPlayers = useMemo(
    () => playerMap([...suggestedRoster, ...currentRoster]),
    [currentRoster, suggestedRoster],
  );
  const [selected, setSelected] = useState(() => playerMap(currentRoster));
  const [draft, setDraft] = useState<AdminDraft<RosterDraftData> | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  useEffect(() => {
    if (saved) {
      removeAdminDraft({ flow: "roster", competitionId, entityId: registrationId });
      return;
    }
    const result = readAdminDraft<RosterDraftData>({
      flow: "roster",
      competitionId,
      entityId: registrationId,
    });
    if (result.status === "available") setDraft(result.draft);
  }, [competitionId, registrationId, saved]);

  useEffect(() => {
    if (!pendingDraft) return;
    const timeout = window.setTimeout(() => {
      const time = saveAdminDraft(
        { flow: "roster", competitionId, entityId: registrationId },
        {
          entries: [...selected.values()].map((player) => ({
            playerId: player.id,
            jerseyNumber: player.jerseyNumber,
          })),
        },
      );
      setSavedAt(time);
      setPendingDraft(false);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [competitionId, pendingDraft, registrationId, selected]);

  const selectedIds = useMemo(() => new Set(selected.keys()), [selected]);
  const eligibleSuggestion = useMemo(
    () => suggestedRoster.filter((player) => !player.conflict),
    [suggestedRoster],
  );
  const suggestionConflicts = suggestedRoster.length - eligibleSuggestion.length;
  const duplicateJerseys = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const player of selected.values()) {
      const jersey = player.jerseyNumber.trim();
      if (!jersey) continue;
      if (seen.has(jersey)) duplicates.add(jersey);
      seen.add(jersey);
    }
    return duplicates;
  }, [selected]);
  const submitting =
    navigation.state !== "idle" &&
    navigation.formData?.get("registrationId") === String(registrationId);

  const update = (next: Map<number, RosterPlayer>) => {
    setSelected(next);
    setPendingDraft(true);
    setRestoreMessage(null);
  };

  const selectPlayer = (player: AdminPlayerSearchResult) => {
    const next = new Map(selected);
    if (next.has(player.id)) next.delete(player.id);
    else next.set(player.id, { ...player, jerseyNumber: player.editionJersey ?? "" });
    update(next);
  };

  const restore = () => {
    if (!draft) return;
    const next = new Map<number, RosterPlayer>();
    let skipped = 0;
    for (const entry of draft.data.entries) {
      const player = knownPlayers.get(entry.playerId);
      if (!player) {
        skipped += 1;
        continue;
      }
      next.set(player.id, { ...player, jerseyNumber: entry.jerseyNumber });
    }
    setSelected(next);
    setSavedAt(draft.savedAt);
    setDraft(null);
    setRestoreMessage(
      skipped
        ? `${skipped} referência(s) indisponível(is) foram ignoradas.`
        : "Rascunho restaurado.",
    );
  };

  const discard = () => {
    removeAdminDraft({ flow: "roster", competitionId, entityId: registrationId });
    setDraft(null);
    setSavedAt(null);
  };

  const useSuggestion = () => {
    update(playerMap(eligibleSuggestion));
  };

  return (
    <Form method="post" className="roster-editor">
      <UnsavedChangesGuard active={pendingDraft} />
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="intent" value="replace-roster" />
      <input type="hidden" name="registrationId" value={registrationId} />
      {draft ? (
        <AdminDraftNotice savedAt={draft.savedAt} onRestore={restore} onDiscard={discard} />
      ) : null}
      {restoreMessage ? <output className="admin-note">{restoreMessage}</output> : null}
      {suggestedRoster.length ? (
        <div className="roster-suggestion">
          <span>
            <strong>Sugestão disponível</strong>
            <small>{suggestionLabel ?? "Último elenco confirmado"}</small>
            {suggestionConflicts ? (
              <small>
                {suggestionConflicts} atleta(s) já estão em outra equipe e serão ignorados.
              </small>
            ) : null}
          </span>
          <button className="button button-ghost" type="button" onClick={useSuggestion}>
            Usar {eligibleSuggestion.length} atletas elegíveis
          </button>
        </div>
      ) : null}
      <AdminPlayerSearch
        competitionId={competitionId}
        registrationId={registrationId}
        csrfToken={csrfToken}
        selectedIds={selectedIds}
        onSelect={selectPlayer}
      />
      <fieldset className="roster-selected-list">
        <legend>Selecionados ({selected.size})</legend>
        {selected.size === 0 ? <p>Nenhum atleta selecionado.</p> : null}
        {[...selected.values()].map((player) => {
          const jerseyError = duplicateJerseys.has(player.jerseyNumber.trim());
          return (
            <div className="roster-selected-row" key={player.id}>
              <input type="hidden" name="playerId" value={player.id} />
              <span>
                <strong>{player.fullName}</strong>
                {player.nickname ? <small>“{player.nickname}”</small> : null}
              </span>
              <label>
                Camisa
                <input
                  name={`jersey-${player.id}`}
                  value={player.jerseyNumber}
                  inputMode="numeric"
                  pattern="(?:0|00|[1-9][0-9]?)"
                  maxLength={2}
                  aria-invalid={jerseyError || undefined}
                  aria-describedby={jerseyError ? `jersey-error-${player.id}` : undefined}
                  onChange={(event) => {
                    const next = new Map(selected);
                    next.set(player.id, { ...player, jerseyNumber: event.currentTarget.value });
                    update(next);
                  }}
                />
                <InlineFieldError
                  id={`jersey-error-${player.id}`}
                  message={jerseyError ? "Camisa repetida" : null}
                />
              </label>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => selectPlayer(player)}
              >
                Remover
              </button>
            </div>
          );
        })}
      </fieldset>
      <StickyActionSummary
        title={`Elenco — ${teamName}`}
        metrics={[
          { label: "Selecionados", value: selected.size },
          { label: "Conflitos", value: duplicateJerseys.size },
        ]}
        status={
          pendingDraft
            ? "Salvando rascunho…"
            : savedAt
              ? "Rascunho salvo neste navegador"
              : "Sem alterações"
        }
      >
        <button
          className="button button-primary"
          type="submit"
          disabled={submitting || duplicateJerseys.size > 0}
        >
          {submitting ? "Salvando…" : "Salvar elenco"}
        </button>
      </StickyActionSummary>
    </Form>
  );
}
