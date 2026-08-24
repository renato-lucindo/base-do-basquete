import { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import type { CompetitionContext } from "../modules/competition/context";
import {
  normalizePublicSearch,
  PUBLIC_SEARCH_MIN_LENGTH,
  type PublicSearchGroup,
  type PublicSearchItem,
} from "../modules/search/public-search-domain";

interface SearchResponse {
  groups: PublicSearchGroup[];
  query: string;
}

export function ContextualSearch({ context }: { context: CompetitionContext }) {
  const navigate = useNavigate();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<PublicSearchGroup[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const normalized = normalizePublicSearch(query);
  const expanded = normalized.length >= PUBLIC_SEARCH_MIN_LENGTH && status !== "idle";

  useEffect(() => {
    if (normalized.length < PUBLIC_SEARCH_MIN_LENGTH) {
      setGroups([]);
      setStatus("idle");
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const params = new URLSearchParams({
          competitionId: String(context.competitionId),
          q: normalized,
        });
        const response = await fetch(`/api/public-search?${params}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        const payload = (await response.json()) as SearchResponse;
        setGroups(payload.groups);
        setStatus("ready");
        setActiveIndex(-1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setGroups([]);
          setStatus("error");
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [context.competitionId, normalized]);

  const selectItem = (item: PublicSearchItem | undefined) => {
    if (item) navigate(item.href);
  };

  return (
    <search>
      <form
        className="contextual-search"
      onSubmit={(event) => {
        event.preventDefault();
        selectItem(items[activeIndex] ?? items[0]);
      }}
      >
      <label htmlFor={`${listboxId}-input`}>Buscar nesta edição</label>
      <input
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={expanded}
        autoComplete="off"
        id={`${listboxId}-input`}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && items.length > 0) {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % items.length);
          } else if (event.key === "ArrowUp" && items.length > 0) {
            event.preventDefault();
            setActiveIndex((current) => (current <= 0 ? items.length - 1 : current - 1));
          } else if (event.key === "Escape") {
            setQuery("");
            setGroups([]);
            setStatus("idle");
          }
        }}
        placeholder="Atleta, equipe, categoria ou ano"
        role="combobox"
        type="search"
        value={query}
      />
      <span aria-live="polite" className="sr-only">
        {status === "loading"
          ? "Buscando"
          : status === "ready"
            ? `${items.length} resultado(s) encontrados`
            : status === "error"
              ? "Busca indisponível"
              : "Digite ao menos dois caracteres"}
      </span>

      {expanded ? (
        <div className="contextual-search-results" id={listboxId} role="listbox">
          {status === "loading" ? <p>Buscando…</p> : null}
          {status === "error" ? <p>Busca temporariamente indisponível.</p> : null}
          {status === "ready" && items.length === 0 ? <p>Nenhum resultado encontrado.</p> : null}
          {groups.map((group) => (
            <fieldset key={group.type}>
              <legend>{group.label}</legend>
              {group.items.map((item) => {
                const index = items.findIndex((candidate) => candidate.id === item.id);
                return (
                  <Link
                    aria-selected={activeIndex === index}
                    id={`${listboxId}-option-${index}`}
                    key={item.id}
                    onMouseEnter={() => setActiveIndex(index)}
                    role="option"
                    to={item.href}
                  >
                    <span>{item.label}</span>
                    <small>{item.description}</small>
                  </Link>
                );
              })}
            </fieldset>
          ))}
        </div>
      ) : null}
      </form>
    </search>
  );
}
