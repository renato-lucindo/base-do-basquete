import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { type CompetitionContext, contextPath } from "../modules/competition/context";
import type { PublicAchievement } from "../modules/competition/public-data.server";
import { BOXSCORE_METRICS, type BoxscoreMetric } from "../modules/statistics/boxscore-metrics";
import type {
  PlayerCompetitionSummary,
  PublicPlayerGame,
  PublicPlayerProfileDto,
} from "../modules/statistics/player-profile.server";
import { groupPlayerAchievements, perGame } from "../modules/statistics/player-profile-domain";
import { ResourceState } from "./resource-state";
import { ScrollableTable } from "./scrollable-table";

const profileSections = [
  ["resumo", "Resumo"],
  ["estatisticas", "Estatísticas"],
  ["conquistas", "Conquistas"],
  ["jogos", "Jogos"],
  ["historico", "Histórico"],
] as const;

const detailMetrics: BoxscoreMetric[] = [
  "games",
  "minutes",
  "points",
  "rebounds",
  "offensiveRebounds",
  "defensiveRebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "foulsCommitted",
  "foulsReceived",
  "fieldGoalsMade",
  "fieldGoalsAttempted",
  "threePointersMade",
  "threePointersAttempted",
  "freeThrowsMade",
  "freeThrowsAttempted",
  "fieldGoalPercentage",
  "threePointPercentage",
  "freeThrowPercentage",
  "efficiency",
  "plusMinus",
];

function number(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(".", ",")}${suffix}`;
}

function heightLabel(valueCm: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valueCm / 100);
}

function dateLabel(value: string | null, compact = false): string {
  if (!value) return "Data a definir";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    ...(compact ? {} : { year: "numeric" }),
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function pointsForGame(game: PublicPlayerGame): number | null {
  if (game.didNotPlay) return null;
  return game.kind === "scoresheet" ? game.points : game.officialPoints;
}

function metricValue(profile: PublicPlayerProfileDto, metric: BoxscoreMetric): string {
  const cell = profile.currentBoxscore?.row?.metrics[metric];
  if (cell?.status !== "available") return "—";
  return number(cell.value, metric.endsWith("Percentage") ? "%" : "");
}

function summaryPoints(item: PlayerCompetitionSummary): number | null {
  return item.kind === "scoresheet" ? item.points : item.officialPoints;
}

function scopeLabel(scope: PublicPlayerProfileDto["selection"]["scope"]): string {
  if (scope === "regular") return "Regular";
  if (scope === "playoffs") return "Eliminatório";
  return "Ambos";
}

function modeLabel(mode: PublicPlayerProfileDto["selection"]["mode"]): string {
  if (mode === "total") return "Total";
  if (mode === "per-30") return "Por 30 min.";
  return "Por jogo";
}

function placementName(placement: number): string {
  if (placement === 1) return "Primeiro lugar";
  if (placement === 2) return "Segundo lugar";
  if (placement === 3) return "Terceiro lugar";
  return `${placement}º lugar`;
}

function PlayerIdentityHeader({
  context,
  profile,
  listPath,
  comparePath,
}: {
  context: CompetitionContext;
  profile: PublicPlayerProfileDto;
  listPath: string;
  comparePath: string;
}) {
  const current = profile.current;
  const teamPath =
    current?.teamSlug && current.teamName
      ? contextPath(context, "equipes", current.teamSlug)
      : null;
  return (
    <>
      <Link className="back-link" to={listPath}>
        ← Jogadores
      </Link>
      <header className="player-profile-header">
        <div
          aria-label={`Camisa ${current?.jerseyNumber ?? "sem número"}`}
          className="player-jersey"
          role="img"
        >
          {current?.jerseyNumber ?? "—"}
        </div>
        <div className="player-identity-copy">
          <h1>{profile.fullName}</h1>
          {profile.nickname ? <p className="player-nickname">“{profile.nickname}”</p> : null}
          <p className="player-identity-line">
            {teamPath && current?.teamName ? (
              <Link to={teamPath}>{current.teamName}</Link>
            ) : current?.teamName ? (
              <span>{current.teamName}</span>
            ) : null}
            {(current?.position ?? profile.mainPosition) ? (
              <span>{current?.position ?? profile.mainPosition}</span>
            ) : null}
            <span>{context.category.name}</span>
          </p>
          {profile.birthYear || profile.heightCm || profile.hand ? (
            <p className="player-personal-line">
              {profile.birthYear ? <span>Nasc. {profile.birthYear}</span> : null}
              {profile.heightCm ? <span>{heightLabel(profile.heightCm)} m</span> : null}
              {profile.hand ? <span>{profile.hand}</span> : null}
            </p>
          ) : null}
        </div>
        {context.statisticsMode === "boxscore" ? (
          <Link className="button compare-profile-action" to={comparePath}>
            Comparar jogador
          </Link>
        ) : null}
      </header>
    </>
  );
}

function ProfileNavigation({ activeSection }: { activeSection: string }) {
  return (
    <nav aria-label="Seções do perfil" className="player-profile-nav">
      {profileSections.map(([id, label]) => (
        <a aria-current={activeSection === id ? "location" : undefined} href={`#${id}`} key={id}>
          {label}
        </a>
      ))}
    </nav>
  );
}

function CompetitionControls({
  context,
  profile,
}: {
  context: CompetitionContext;
  profile: PublicPlayerProfileDto;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const current = profile.current;
  const changeQuery = (name: "mode" | "scope", value: string) => {
    const next = new URLSearchParams(searchParams);
    if ((name === "mode" && value === "per-game") || (name === "scope" && value === "regular")) {
      next.delete(name);
    } else {
      next.set(name, value);
    }
    navigate(`${contextPath(context, "jogadores", profile.slug)}${next.size ? `?${next}` : ""}`);
  };
  return (
    <div className="player-competition-controls">
      <label>
        <span>Competição</span>
        <select
          aria-label="Competição"
          onChange={(event) => {
            const selected = profile.competitions.find(
              (item) => item.context.competitionId === Number(event.currentTarget.value),
            );
            if (!selected) return;
            const next = new URLSearchParams(searchParams);
            if (selected.kind !== "boxscore") {
              next.delete("mode");
              next.delete("scope");
            }
            navigate(
              `${contextPath(selected.context, "jogadores", profile.slug)}${next.size ? `?${next}` : ""}`,
            );
          }}
          value={context.competitionId}
        >
          {profile.competitions.map((item) => (
            <option key={item.context.competitionId} value={item.context.competitionId}>
              {item.context.year} · {item.context.series.name} · {item.context.category.name}
            </option>
          ))}
        </select>
      </label>
      {current?.kind === "boxscore" ? (
        <>
          <fieldset>
            <legend>Fase</legend>
            <div className="segmented-control">
              {(
                [
                  ["regular", "Regular"],
                  ["playoffs", "Eliminatório"],
                  ["all", "Ambos"],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    checked={profile.selection.scope === value}
                    name="profile-scope"
                    onChange={() => changeQuery("scope", value)}
                    type="radio"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Exibição</legend>
            <div className="segmented-control">
              {(
                [
                  ["per-game", "Por jogo"],
                  ["total", "Total"],
                  ["per-30", "Por 30 min."],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    checked={profile.selection.mode === value}
                    name="profile-mode"
                    onChange={() => changeQuery("mode", value)}
                    type="radio"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
    </div>
  );
}

function PlayerSummaryMetrics({ profile }: { profile: PublicPlayerProfileDto }) {
  const current = profile.current;
  if (!current?.games) return null;
  if (current.kind === "scoresheet") {
    const metrics = [
      ["J", current.games],
      ["PTS", current.points],
      ["PTS/J", current.points === null ? null : perGame(current.points, current.games)],
      ["2PC", current.twoPointMade],
      ["3PC", current.threePointMade],
      ["LLC", current.freeThrowMade],
    ] as const;
    return (
      <>
        <dl className="player-key-metrics">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{number(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="player-availability-note">
          Nesta edição estão disponíveis jogos, pontos, cestas convertidas, lances livres e faltas.
        </p>
      </>
    );
  }
  if (!profile.currentBoxscore?.row) {
    return (
      <ResourceState
        detail={`Não há participação publicada para ${scopeLabel(profile.selection.scope).toLocaleLowerCase("pt-BR")} nesta edição.`}
        kind="empty"
        title="Sem estatísticas neste recorte"
      />
    );
  }
  const metrics: Array<[string, BoxscoreMetric]> = [["J", "games"]];
  if (profile.selection.mode !== "per-30") metrics.push(["MIN", "minutes"]);
  metrics.push(
    ["PTS", "points"],
    ["REB", "rebounds"],
    ["AST", "assists"],
    ["AP", "fieldGoalPercentage"],
  );
  return (
    <>
      <dl aria-live="polite" className="player-key-metrics">
        {metrics.map(([label, metric]) => (
          <div key={metric}>
            <dt>{label}</dt>
            <dd>{metricValue(profile, metric)}</dd>
          </div>
        ))}
      </dl>
      <p className="player-summary-note">
        {modeLabel(profile.selection.mode)} · {scopeLabel(profile.selection.scope)}
        {profile.selection.mode === "per-30"
          ? ` · mínimo de ${(profile.currentBoxscore.per30MinimumSeconds ?? 600) / 60} minutos totais`
          : ""}
      </p>
    </>
  );
}

function RecentGames({
  context,
  games,
}: {
  context: CompetitionContext;
  games: PublicPlayerGame[];
}) {
  const recent = games
    .filter((game) => game.context.competitionId === context.competitionId)
    .slice(0, 5);
  if (!recent.length) return null;
  return (
    <section aria-labelledby="recent-games-title" className="player-recent-games">
      <div>
        <p className="eyebrow">Últimas partidas · todas as fases</p>
        <h3 id="recent-games-title">Jogos recentes</h3>
      </div>
      <ol>
        {recent.map((game) => (
          <li key={game.id}>
            <Link to={contextPath(game.context, "jogos", game.id)}>
              {dateLabel(game.scheduledAt, true)}
            </Link>
            <span>{game.opponentName ?? "Adversário a confirmar"}</span>
            <strong data-result={game.result}>
              {game.didNotPlay
                ? "Não jogou"
                : `${game.result ?? "Resultado pendente"}${game.score ? ` ${game.score}` : ""}`}
            </strong>
            <strong>{game.didNotPlay ? "—" : `${number(pointsForGame(game))} PTS`}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CompetitionHistory({ profile }: { profile: PublicPlayerProfileDto }) {
  return (
    <ScrollableTable label="Histórico estatístico do atleta por competição">
      <table className="statistics-table player-statistics-table">
        <caption>Resumo por competição</caption>
        <thead>
          <tr>
            <th scope="col">Edição</th>
            <th scope="col">Equipe</th>
            <th scope="col">J</th>
            <th scope="col">PTS</th>
            <th scope="col">PTS/J</th>
          </tr>
        </thead>
        <tbody>
          {profile.competitions.map((item) => {
            const points = summaryPoints(item);
            return (
              <tr key={item.context.competitionId}>
                <th scope="row">
                  <Link to={contextPath(item.context, "jogadores", profile.slug)}>
                    <strong>
                      {item.context.year} · {item.context.series.name}
                    </strong>
                    <span>{item.context.category.name}</span>
                  </Link>
                </th>
                <td>{item.teamAbbreviation ?? item.teamName ?? "—"}</td>
                <td>{item.games}</td>
                <td>{number(points)}</td>
                <td>{number(points === null ? null : perGame(points, item.games))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollableTable>
  );
}

function CompetitionDetail({ profile }: { profile: PublicPlayerProfileDto }) {
  const current = profile.current;
  if (!current?.games) return null;
  if (current.kind === "scoresheet") {
    const cells = [
      ["J", current.games],
      ["PTS", current.points],
      ["PTS/J", current.points === null ? null : perGame(current.points, current.games)],
      ["2PC", current.twoPointMade],
      ["3PC", current.threePointMade],
      ["LLC", current.freeThrowMade],
      ["F", current.fouls],
      ["GD", current.disqualifications],
    ] as const;
    return (
      <dl className="player-detail-list">
        {cells.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{number(value)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (!profile.currentBoxscore?.row) return null;
  const visibleMetrics = detailMetrics.filter(
    (metric) =>
      (profile.selection.mode !== "per-30" || metric !== "minutes") &&
      profile.currentBoxscore?.row?.metrics[metric].status !== "unavailable",
  );
  return (
    <ScrollableTable label="Detalhamento estatístico da competição selecionada">
      <table className="statistics-table player-competition-detail-table">
        <caption>Detalhamento da competição selecionada</caption>
        <thead>
          <tr>
            {visibleMetrics.map((metric) => (
              <th key={metric} scope="col">
                {BOXSCORE_METRICS[metric].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {visibleMetrics.map((metric, index) =>
              index === 0 ? (
                <th key={metric} scope="row">
                  {metricValue(profile, metric)}
                </th>
              ) : (
                <td key={metric}>{metricValue(profile, metric)}</td>
              ),
            )}
          </tr>
        </tbody>
      </table>
    </ScrollableTable>
  );
}

function Achievements({
  achievements,
  profile,
}: {
  achievements: PublicAchievement[];
  profile: PublicPlayerProfileDto;
}) {
  const groups = useMemo(() => groupPlayerAchievements(achievements), [achievements]);
  return (
    <>
      {groups.length ? (
        <div className="player-achievement-groups">
          {groups.map((group) => (
            <section key={group.competitionName}>
              <h3>{group.competitionName}</h3>
              <ul>
                {group.entries.map((item) => (
                  <li key={`${item.placement}-${item.categoryName}`}>
                    <span className="player-placement">
                      <span aria-hidden="true">{item.placement}º</span>
                      <span className="sr-only">{placementName(item.placement)}</span>
                    </span>
                    <strong>
                      {item.categoryName} — {item.years.join(", ")}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="muted-copy">Nenhuma conquista coletiva confirmada.</p>
      )}
      {profile.honors.length ? (
        <section aria-labelledby="individual-honors-title" className="player-individual-honors">
          <h3 id="individual-honors-title">Honrarias individuais</h3>
          <ul>
            {profile.honors.map((honor) => (
              <li key={honor.id}>
                <strong>{honor.title}</strong>
                <span> — {[honor.competitionName, honor.year].filter(Boolean).join(", ")}</span>
                {honor.description ? <p>{honor.description}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function PlayerGames({ games }: { games: PublicPlayerGame[] }) {
  const years = [...new Set(games.map((game) => game.context.year))].sort((a, b) => b - a);
  const [year, setYear] = useState<number | "all">("all");
  const [competitionId, setCompetitionId] = useState<number | "all">("all");
  const filtered = games.filter(
    (game) =>
      (year === "all" || game.context.year === year) &&
      (competitionId === "all" || game.context.competitionId === competitionId),
  );
  const competitions = [
    ...new Map(games.map((game) => [game.context.competitionId, game.context])).values(),
  ];
  const tableKind = filtered.every((game) => game.kind === "scoresheet")
    ? "scoresheet"
    : filtered.every((game) => game.kind === "boxscore")
      ? "boxscore"
      : "mixed";
  const columns =
    tableKind === "scoresheet"
      ? ["Data", "Adversário", "Resultado", "PTS", "2PC", "3PC", "LLC", "F", "GD"]
      : tableKind === "boxscore"
        ? ["Data", "Adversário", "Resultado", "MIN", "PTS", "REB", "AST"]
        : ["Data", "Adversário", "Resultado", "PTS"];
  return (
    <>
      <div className="player-game-filters">
        <label>
          <span>Ano</span>
          <select
            onChange={(event) =>
              setYear(
                event.currentTarget.value === "all" ? "all" : Number(event.currentTarget.value),
              )
            }
            value={year}
          >
            <option value="all">Todos</option>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Competição</span>
          <select
            onChange={(event) =>
              setCompetitionId(
                event.currentTarget.value === "all" ? "all" : Number(event.currentTarget.value),
              )
            }
            value={competitionId}
          >
            <option value="all">Todas</option>
            {competitions.map((item) => (
              <option key={item.competitionId} value={item.competitionId}>
                {item.year} · {item.series.name} · {item.category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length ? (
        <ScrollableTable label="Jogos do atleta">
          <table className="statistics-table player-games-table">
            <caption>Jogos publicados</caption>
            <thead>
              <tr>
                {columns.map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((game) => {
                const totals = game.kind === "boxscore" ? game.advancedTotals : null;
                const scoresheet = game.kind === "scoresheet" ? game : null;
                return (
                  <tr key={game.id}>
                    <th scope="row">
                      <Link to={contextPath(game.context, "jogos", game.id)}>
                        {dateLabel(game.scheduledAt)}
                      </Link>
                    </th>
                    <td>{game.opponentName ?? "—"}</td>
                    <td>
                      <span data-result={game.result}>
                        {game.didNotPlay
                          ? "Não jogou"
                          : `${game.result ?? "Resultado pendente"}${game.score ? ` · ${game.score}` : ""}`}
                      </span>
                    </td>
                    {tableKind === "boxscore" ? (
                      <>
                        <td>
                          {game.didNotPlay
                            ? "—"
                            : number(totals ? totals.secondsPlayed / 60 : null)}
                        </td>
                        <td>{game.didNotPlay ? "—" : number(pointsForGame(game))}</td>
                        <td>
                          {game.didNotPlay
                            ? "—"
                            : number(
                                totals ? totals.offensiveRebounds + totals.defensiveRebounds : null,
                              )}
                        </td>
                        <td>{game.didNotPlay ? "—" : number(totals?.assists ?? null)}</td>
                      </>
                    ) : tableKind === "scoresheet" ? (
                      <>
                        <td>{game.didNotPlay ? "—" : number(pointsForGame(game))}</td>
                        <td>{game.didNotPlay ? "—" : number(scoresheet?.twoPointMade ?? null)}</td>
                        <td>
                          {game.didNotPlay ? "—" : number(scoresheet?.threePointMade ?? null)}
                        </td>
                        <td>{game.didNotPlay ? "—" : number(scoresheet?.freeThrowMade ?? null)}</td>
                        <td>{game.didNotPlay ? "—" : number(scoresheet?.fouls ?? null)}</td>
                        <td>
                          {game.didNotPlay ? "—" : number(scoresheet?.disqualifications ?? null)}
                        </td>
                      </>
                    ) : (
                      <td>{game.didNotPlay ? "—" : number(pointsForGame(game))}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableTable>
      ) : (
        <ResourceState
          kind="empty"
          title="Nenhum jogo publicado"
          detail="Não há jogos para os filtros selecionados."
        />
      )}
    </>
  );
}

function TeamHistory({ profile }: { profile: PublicPlayerProfileDto }) {
  const rows = useMemo(() => {
    const groups = new Map<string, PlayerCompetitionSummary[]>();
    for (const item of profile.competitions) {
      const key = `${item.context.year}:${item.teamSlug ?? item.teamName ?? "team"}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.values()]
      .flatMap((items) => {
        const first = items[0];
        return first ? [{ first, items }] : [];
      })
      .sort((left, right) => right.first.context.year - left.first.context.year);
  }, [profile.competitions]);
  const publicInfo = [
    ["Nome completo", profile.fullName],
    ["Apelido", profile.nickname],
    ["Ano de nascimento", profile.birthYear],
    ["Altura", profile.heightCm ? `${heightLabel(profile.heightCm)} m` : null],
    ["Posição", profile.mainPosition],
    ["Lateralidade", profile.hand],
  ].filter((item) => item[1] !== null);
  return (
    <div className="player-history-layout">
      <section aria-labelledby="team-history-title">
        <h3 id="team-history-title">Equipes por temporada</h3>
        <ol className="player-team-history">
          {rows.map(({ first, items }) => {
            const jerseys = [...new Set(items.map((item) => item.jerseyNumber).filter(Boolean))];
            const categories = [...new Set(items.map((item) => item.context.category.name))];
            return (
              <li key={`${first.context.year}-${first.teamSlug ?? first.teamName}`}>
                <time>{first.context.year}</time>
                <div>
                  <strong>
                    {first.teamName ?? "Equipe"}
                    {jerseys.length
                      ? ` · camisa${jerseys.length > 1 ? "s" : ""} ${jerseys.join(" e ")}`
                      : ""}
                  </strong>
                  <p>
                    {categories.join(" e ")} · {items.length}{" "}
                    {items.length === 1 ? "competição" : "competições"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      {publicInfo.length || profile.bio ? (
        <aside aria-labelledby="public-info-title">
          <h3 id="public-info-title">Informações pessoais</h3>
          {publicInfo.length ? (
            <dl className="player-public-information">
              {publicInfo.map(([label, value]) => (
                <div key={String(label)}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {profile.bio ? <p>{profile.bio}</p> : null}
        </aside>
      ) : null}
    </div>
  );
}

export function PlayerProfile({
  achievements,
  context,
  profile,
}: {
  achievements: PublicAchievement[];
  context: CompetitionContext;
  profile: PublicPlayerProfileDto;
}) {
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState("resumo");
  const listPath = `${contextPath(context, "jogadores")}${searchParams.size ? `?${searchParams}` : ""}`;
  const compareParams = new URLSearchParams(searchParams);
  compareParams.set("compare", `${profile.id},`);
  const comparePath = `${contextPath(context, "jogadores")}?${compareParams}`;

  useEffect(() => {
    const sections = profileSections.flatMap(([id]) => {
      const section = document.getElementById(id);
      return section ? [section] : [];
    });
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-20% 0px -65%", threshold: [0, 0.25, 0.6] },
    );
    sections.forEach((section) => {
      observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <article className="player-profile">
      <PlayerIdentityHeader
        comparePath={comparePath}
        context={context}
        listPath={listPath}
        profile={profile}
      />
      <ProfileNavigation activeSection={activeSection} />
      <section className="player-profile-section" id="resumo">
        <header className="profile-section-heading">
          <div>
            <p className="eyebrow">Competição selecionada</p>
            <h2>Resumo</h2>
          </div>
        </header>
        <CompetitionControls context={context} profile={profile} />
        <PlayerSummaryMetrics profile={profile} />
        <RecentGames context={context} games={profile.games} />
      </section>
      <section className="player-profile-section" id="estatisticas">
        <header className="profile-section-heading">
          <div>
            <p className="eyebrow">Trajetória esportiva</p>
            <h2>Estatísticas por competição</h2>
          </div>
        </header>
        {profile.competitions.length ? (
          <CompetitionHistory profile={profile} />
        ) : (
          <ResourceState
            kind="empty"
            title="Sem estatísticas publicadas"
            detail="O atleta ainda não possui competições finalizadas."
          />
        )}
        {profile.current?.games ? (
          <section
            aria-labelledby="selected-competition-title"
            className="player-selected-competition"
          >
            <header>
              <div>
                <p className="eyebrow">Competição selecionada</p>
                <h3 id="selected-competition-title">
                  {context.year} · {context.series.name} · {context.category.name}
                </h3>
              </div>
              {profile.current.kind === "boxscore" ? (
                <p>
                  {scopeLabel(profile.selection.scope)} · {modeLabel(profile.selection.mode)}
                </p>
              ) : null}
            </header>
            <CompetitionDetail profile={profile} />
          </section>
        ) : null}
      </section>
      <section className="player-profile-section" id="conquistas">
        <header className="profile-section-heading">
          <div>
            <h2>Conquistas e honrarias</h2>
          </div>
        </header>
        <Achievements achievements={achievements} profile={profile} />
      </section>
      <section className="player-profile-section" id="jogos">
        <header className="profile-section-heading">
          <div>
            <h2>Jogos</h2>
          </div>
        </header>
        <PlayerGames games={profile.games} />
      </section>
      <section className="player-profile-section" id="historico">
        <header className="profile-section-heading">
          <div>
            <h2>Histórico</h2>
          </div>
        </header>
        <TeamHistory profile={profile} />
      </section>
    </article>
  );
}
