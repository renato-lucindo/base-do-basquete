import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { sortAdminPlayers, type AdminPlayerSearchResult } from "../../modules/players/admin-domain";
import { InlinePlayerCreateDialog } from "./inline-player-create-dialog";

interface SearchResponse {
  error?: string;
  results: AdminPlayerSearchResult[];
}

interface AdminPlayerSearchProps {
  competitionId: number;
  competitionGender: string | null;
  csrfToken: string;
  registrationId?: number;
  selectedIds?: ReadonlySet<number>;
  onSelect: (player: AdminPlayerSearchResult) => void;
  label?: string;
}

export function AdminPlayerSearch({
  competitionId,
  competitionGender,
  csrfToken,
  registrationId,
  selectedIds = new Set<number>(),
  onSelect,
  label = "Buscar atleta por nome ou apelido",
}: AdminPlayerSearchProps) {
  const fetcher = useFetcher<SearchResponse>();
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ competitionId: String(competitionId), q: normalized });
      if (registrationId) params.set("registrationId", String(registrationId));
      fetcher.load(`/api/admin/players?${params}`);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [competitionId, fetcher.load, query, registrationId]);

  const results = useMemo(
    () => sortAdminPlayers(fetcher.data?.results ?? [], selectedIds),
    [fetcher.data?.results, selectedIds],
  );
  const searched = query.trim().length >= 2;
  const loading = searched && fetcher.state !== "idle";
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    requestAnimationFrame(() => createButtonRef.current?.focus());
  }, []);

  return (
    <div className="admin-player-search">
      <div className="admin-player-search-control">
        <label>
          {label}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Digite pelo menos 2 caracteres"
            autoComplete="off"
            aria-controls="admin-player-search-results"
          />
        </label>
        <button
          ref={createButtonRef}
          className="button button-secondary"
          type="button"
          onClick={() => setDialogOpen(true)}
        >
          Novo atleta
        </button>
      </div>
      <div className="admin-player-results" id="admin-player-search-results" aria-live="polite">
        {!searched ? <p>Digite ao menos dois caracteres para pesquisar.</p> : null}
        {loading ? <p>Pesquisando atletas…</p> : null}
        {!loading && fetcher.data?.error ? (
          <p className="form-error">{fetcher.data.error}</p>
        ) : null}
        {!loading && searched && !fetcher.data?.error && results.length === 0 ? (
          <p>Nenhum atleta encontrado. Você pode criar um novo cadastro.</p>
        ) : null}
        {!loading && results.length > 0 ? (
          <ul>
            {results.map((player) => {
              const selected = selectedIds.has(player.id);
              const unavailable = Boolean(player.conflict);
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    disabled={unavailable}
                    aria-pressed={selected}
                    onClick={() => onSelect(player)}
                  >
                    <span>
                      <strong>{player.fullName}</strong>
                      {player.nickname ? <small>“{player.nickname}”</small> : null}
                    </span>
                    <span>
                      {unavailable
                        ? `Inscrito por ${player.conflict?.teamName}`
                        : selected
                          ? "Selecionado"
                          : player.currentTeamName
                            ? `${player.currentTeamName}${player.editionJersey ? ` · #${player.editionJersey}` : ""}`
                            : "Adicionar"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <InlinePlayerCreateDialog
        csrfToken={csrfToken}
        editionGender={competitionGender}
        initialName={query.trim()}
        open={dialogOpen}
        onClose={closeDialog}
        onCreated={onSelect}
      />
    </div>
  );
}
