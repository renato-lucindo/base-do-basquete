import { Link, NavLink, useNavigate } from "react-router";

import {
  contextPath,
  PUBLIC_RESOURCES,
  type CompetitionContext,
  type PublicResource,
} from "../modules/competition/context";

const resourceLabels: Record<PublicResource, string> = {
  classificacao: "Classificação",
  jogadores: "Jogadores",
  equipes: "Equipes",
  jogos: "Jogos",
};

interface PublicNavigationProps {
  context: CompetitionContext;
  contexts: CompetitionContext[];
  resource: PublicResource;
  detailLabel?: string;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function PublicHeader({ context, contexts, resource }: PublicNavigationProps) {
  const navigate = useNavigate();
  const years = unique(contexts.map((option) => option.year));
  const series = contexts.filter((option) => option.year === context.year);
  const seriesOptions = unique(series.map((option) => option.series.slug))
    .map((slug) => series.find((option) => option.series.slug === slug))
    .filter((option): option is CompetitionContext => option !== undefined);
  const categoryOptions = contexts.filter(
    (option) => option.year === context.year && option.series.slug === context.series.slug,
  );

  function goTo(next: CompetitionContext | undefined) {
    if (next) {
      navigate(contextPath(next, resource));
    }
  }

  return (
    <header className="public-header">
      <div className="public-header-topline">
        <Link className="brand" to={contextPath(context, "classificacao")}>
          <span className="brand-mark" aria-hidden="true">
            BB
          </span>
          <span>Base do Basquete</span>
        </Link>
        <Link className="admin-link" to="/admin">
          Administração
        </Link>
      </div>

      <fieldset className="context-bar">
        <legend className="sr-only">Selecionar edição</legend>
        <label>
          <span>Ano</span>
          <select
            aria-label="Ano"
            value={context.year}
            onChange={(event) =>
              goTo(contexts.find((option) => option.year === Number(event.currentTarget.value)))
            }
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Competição</span>
          <select
            aria-label="Competição"
            value={context.series.slug}
            onChange={(event) =>
              goTo(series.find((option) => option.series.slug === event.currentTarget.value))
            }
          >
            {seriesOptions.map((option) => (
              <option key={option.series.slug} value={option.series.slug}>
                {option.series.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Categoria</span>
          <select
            aria-label="Categoria"
            value={context.category.slug}
            onChange={(event) =>
              goTo(
                categoryOptions.find(
                  (option) => option.category.slug === event.currentTarget.value,
                ),
              )
            }
          >
            {categoryOptions.map((option) => (
              <option key={option.category.slug} value={option.category.slug}>
                {option.category.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <nav className="public-nav" aria-label="Navegação da edição">
        {PUBLIC_RESOURCES.map((item) => (
          <NavLink
            key={item}
            to={contextPath(context, item)}
            className={({ isActive }) => (isActive ? "active" : undefined)}
            end={false}
          >
            {resourceLabels[item]}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export function PublicBreadcrumb({ context, resource, detailLabel }: PublicNavigationProps) {
  return (
    <nav className="breadcrumb" aria-label="Caminho atual">
      <ol>
        <li>
          <Link to={contextPath(context, "classificacao")}>{context.series.name}</Link>
        </li>
        <li>
          <Link to={contextPath(context, resource)}>
            {context.year} · {context.category.name}
          </Link>
        </li>
        <li aria-current={detailLabel ? undefined : "page"}>{resourceLabels[resource]}</li>
        {detailLabel ? <li aria-current="page">{detailLabel}</li> : null}
      </ol>
    </nav>
  );
}

export function resourceLabel(resource: PublicResource): string {
  return resourceLabels[resource];
}
