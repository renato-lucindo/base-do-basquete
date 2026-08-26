import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

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

type SearchScope = "current" | "global";

export function ContextualSearch({
  context,
  currentPageSupported,
}: {
  context: CompetitionContext;
  currentPageSupported: boolean;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const listboxId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [scope, setScope] = useState<SearchScope>(currentPageSupported ? "current" : "global");
  const [globalQuery, setGlobalQuery] = useState("");
  const [groups, setGroups] = useState<PublicSearchGroup[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const query = scope === "current" ? (searchParams.get("q") ?? "") : globalQuery;
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const normalized = normalizePublicSearch(query);
  const expanded = scope === "global" && open && normalized.length >= PUBLIC_SEARCH_MIN_LENGTH;

  useEffect(() => {
    setScope(currentPageSupported ? "current" : "global");
    setGlobalQuery("");
    setGroups([]);
    setStatus("idle");
    setActiveIndex(-1);
    setOpen(false);
  }, [currentPageSupported]);

  useEffect(() => {
    if (scope !== "global" || normalized.length < PUBLIC_SEARCH_MIN_LENGTH) {
      setGroups([]);
      setStatus("idle");
      setActiveIndex(-1);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      setOpen(true);
      try {
        const params = new URLSearchParams({
          competitionId: String(context.competitionId),
          q: normalized,
          scope: "global",
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
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [context.competitionId, normalized, scope]);

  const updateCurrentQuery = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("q", value);
    else next.delete("q");
    next.delete("page");
    setSearchParams(next, { replace: true });
  };
  const selectItem = (item: PublicSearchItem | undefined) => {
    if (!item) return;
    setOpen(false);
    navigate(item.href);
  };
  const clear = () => {
    if (scope === "current") updateCurrentQuery("");
    else setGlobalQuery("");
    setGroups([]);
    setStatus("idle");
    setOpen(false);
  };

  return (
    <search className="header-search">
      <form
        className="contextual-search"
        onBlur={(event) => {
          if (!formRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (scope === "global") selectItem(items[activeIndex] ?? items[0]);
        }}
        ref={formRef}
      >
        <label className="sr-only" htmlFor={`${listboxId}-input`}>
          Buscar
        </label>
        <div className="search-composite">
          <select
            aria-label="Escopo da busca"
            onChange={(event) => {
              const value = event.target.value as SearchScope;
              setScope(value);
              setOpen(false);
              setActiveIndex(-1);
              if (value === "global") setGlobalQuery("");
            }}
            value={scope}
          >
            {currentPageSupported ? <option value="current">Página atual</option> : null}
            <option value="global">Toda a base</option>
          </select>
          <input
            aria-activedescendant={
              activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
            }
            aria-autocomplete={scope === "global" ? "list" : "none"}
            aria-controls={scope === "global" ? listboxId : undefined}
            aria-expanded={scope === "global" ? expanded : false}
            autoComplete="off"
            id={`${listboxId}-input`}
            onChange={(event) =>
              scope === "current"
                ? updateCurrentQuery(event.currentTarget.value)
                : setGlobalQuery(event.currentTarget.value)
            }
            onFocus={() => scope === "global" && setOpen(true)}
            onKeyDown={(event) => {
              if (scope === "current") {
                if (event.key === "Escape") clear();
                return;
              }
              if (event.key === "ArrowDown" && items.length) {
                event.preventDefault();
                setActiveIndex((current) => (current + 1) % items.length);
              } else if (event.key === "ArrowUp" && items.length) {
                event.preventDefault();
                setActiveIndex((current) => (current <= 0 ? items.length - 1 : current - 1));
              } else if (event.key === "Escape") clear();
            }}
            placeholder={
              scope === "current" ? "Filtrar atletas" : "Atleta, equipe, competição ou jogo"
            }
            role="combobox"
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label="Limpar busca"
              className="search-clear"
              onClick={clear}
              type="button"
            >
              ×
            </button>
          ) : null}
        </div>
        <span aria-live="polite" className="sr-only">
          {scope === "current"
            ? query
              ? "Filtro da página atualizado"
              : "Sem filtro local"
            : status === "loading"
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
            {status === "ready" && !items.length ? <p>Nenhum resultado encontrado.</p> : null}
            {groups.map((group) => (
              <section key={group.type}>
                <h2>{group.label}</h2>
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
              </section>
            ))}
          </div>
        ) : null}
      </form>
    </search>
  );
}
