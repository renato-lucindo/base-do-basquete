import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import {
  type CompetitionContext,
  contextPath,
  genderDivisionLabel,
} from "../modules/competition/context";
import type { PublicAchievement } from "../modules/competition/public-data.server";
import type {
  BoxscorePlayerCompetitionSummary,
  PublicPlayerGame,
  PublicPlayerProfileDto,
  ScoresheetPlayerCompetitionSummary,
} from "../modules/statistics/player-profile.server";
import {
  efficiency,
  type PlayerTotals,
  percentage,
  perGame,
} from "../modules/statistics/player-profile-domain";
import { ResourceState } from "./resource-state";
import { ScrollableTable } from "./scrollable-table";

const profileSections = [
  ["resumo", "Resumo"],
  ["estatisticas", "Estatísticas"],
  ["jogos", "Jogos"],
] as const;

type ProfileMode = "per-game" | "total";

function number(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(".", ",")}${suffix}`;
}

function modeValue(value: number | null, games: number, mode: ProfileMode): number | null {
  if (value === null) return null;
  return mode === "total" ? value : perGame(value, games);
}

function fieldPercentage(totals: PlayerTotals): number | null {
  return percentage(
    totals.twoPointMade + totals.threePointMade,
    totals.twoPointAttempted + totals.threePointAttempted,
  );
}

function dateLabel(value: string | null): string {
  if (!value) return "Data a definir";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function placementLabel(placement: number, resultLabel: string | null): string {
  if (resultLabel) return resultLabel;
  return placement === 1 ? "Campeão" : `${placement}º lugar`;
}

function BoxscoreMetrics({ summary }: { summary: BoxscorePlayerCompetitionSummary }) {
  const totals = summary.advancedTotals;
  const metrics = [
    ["PTS", perGame(summary.officialPoints, summary.games)],
    [
      "REB",
      totals
        ? perGame(totals.offensiveRebounds + totals.defensiveRebounds, summary.advancedGames)
        : null,
    ],
    ["AST", totals ? perGame(totals.assists, summary.advancedGames) : null],
    ["AP%", totals ? fieldPercentage(totals) : null],
    ["EF", totals ? perGame(efficiency(totals), summary.advancedGames) : null],
    [
      "+/-",
      !totals || totals.plusMinus === null
        ? null
        : perGame(totals.plusMinus, summary.advancedGames),
    ],
  ] as const;
  return (
    <dl className="player-key-metrics">
      {metrics.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{number(value, label.includes("%") && value !== null ? "%" : "")}</dd>
        </div>
      ))}
    </dl>
  );
}

function ScoresheetMetrics({ summary }: { summary: ScoresheetPlayerCompetitionSummary }) {
  const metrics = [
    ["J", summary.games],
    ["PTS", summary.points],
    ["PTS/J", summary.points === null ? null : perGame(summary.points, summary.games)],
    ["2PC", summary.twoPointMade],
    ["3PC", summary.threePointMade],
    ["LLC", summary.freeThrowMade],
    ["F", summary.fouls],
    ["GD", summary.disqualifications],
  ] as const;
  return (
    <dl className="player-key-metrics">
      {metrics.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{number(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function gamePoints(game: PublicPlayerGame): number {
  if (game.didNotPlay) return 0;
  return (game.kind === "scoresheet" ? game.points : game.officialPoints) ?? 0;
}

function RecentProduction({ games }: { games: PublicPlayerProfileDto["games"] }) {
  const recent = games.slice(0, 5).reverse();
  if (recent.length < 3) return null;
  const maximum = Math.max(...recent.map(gamePoints), 1);
  const text = recent.map((game) => `${game.label}: ${gamePoints(game)} pontos`).join("; ");
  return (
    <section aria-labelledby="recent-production-title" className="recent-production">
      <header>
        <div>
          <p className="eyebrow">Últimas partidas</p>
          <h3 id="recent-production-title">Produção recente</h3>
        </div>
        <p className="sr-only">{text}</p>
      </header>
      <ol aria-label={text} className="recent-production-chart">
        {recent.map((game) => (
          <li key={game.id}>
            <span style={{ height: `${Math.max(8, (gamePoints(game) / maximum) * 100)}%` }} />
            <strong>{gamePoints(game)}</strong>
            <small>{game.label}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AwardsAndHistory({
  achievements,
  profile,
}: {
  achievements: PublicAchievement[];
  profile: PublicPlayerProfileDto;
}) {
  if (!achievements.length && !profile.honors.length && !profile.competitions.length) return null;
  return (
    <div className="profile-secondary-content">
      {achievements.length || profile.honors.length ? (
        <section aria-labelledby="profile-awards-title">
          <h3 id="profile-awards-title">Conquistas e honrarias</h3>
          <div className="player-awards-grid">
            {achievements.map((achievement) => (
              <article key={`achievement-${achievement.competitionId}-${achievement.teamSlug}`}>
                <span>Conquista coletiva</span>
                <strong>{placementLabel(achievement.placement, achievement.resultLabel)}</strong>
                <p>
                  {achievement.year} · {achievement.seriesName} · {achievement.categoryName} ·{" "}
                  {genderDivisionLabel(achievement.genderDivision)}
                </p>
              </article>
            ))}
            {profile.honors.map((honor) => (
              <article key={`honor-${honor.id}`}>
                <span>Honraria individual</span>
                <strong>{honor.title}</strong>
                <p>{[honor.year, honor.competitionName].filter(Boolean).join(" · ")}</p>
                {honor.description ? <p>{honor.description}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {profile.competitions.length ? (
        <section aria-labelledby="profile-history-title">
          <h3 id="profile-history-title">Histórico de equipes</h3>
          <ol className="player-history">
            {profile.competitions.map((item) => (
              <li key={item.context.competitionId}>
                <strong>
                  {item.context.year} · {item.context.series.name} · {item.context.category.name}
                </strong>
                <span>
                  {[
                    item.teamName,
                    item.jerseyNumber ? `camisa ${item.jerseyNumber}` : null,
                    item.position,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function ScoresheetCompetitionTable({
  items,
  playerSlug,
}: {
  items: ScoresheetPlayerCompetitionSummary[];
  playerSlug: string;
}) {
  if (!items.length) return null;
  return (
    <ScrollableTable label="Estatísticas de súmula do atleta por edição">
      <table className="statistics-table player-statistics-table">
        <caption>Dados registrados por súmula</caption>
        <thead>
          <tr>
            {["Edição", "Equipe", "J", "PTS", "PTS/J", "2PC", "3PC", "LLC", "F", "GD"].map(
              (label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.context.competitionId}>
              <th scope="row">
                <Link to={contextPath(item.context, "jogadores", playerSlug)}>
                  {item.context.year} · {item.context.category.name}
                </Link>
              </th>
              <td>{item.teamAbbreviation ?? item.teamName ?? "—"}</td>
              <td>{item.games}</td>
              <td>{number(item.points)}</td>
              <td>{number(item.points === null ? null : perGame(item.points, item.games))}</td>
              <td>{number(item.twoPointMade)}</td>
              <td>{number(item.threePointMade)}</td>
              <td>{number(item.freeThrowMade)}</td>
              <td>{number(item.fouls)}</td>
              <td>{number(item.disqualifications)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollableTable>
  );
}

function BoxscoreCompetitionTable({
  items,
  mode,
  playerSlug,
}: {
  items: BoxscorePlayerCompetitionSummary[];
  mode: ProfileMode;
  playerSlug: string;
}) {
  if (!items.length) return null;
  return (
    <ScrollableTable label="Estatísticas de boxscore do atleta por edição">
      <table className="statistics-table player-statistics-table">
        <caption>Estatísticas de boxscore por edição</caption>
        <thead>
          <tr>
            {[
              "Edição",
              "Equipe",
              "J",
              "MIN",
              "PTS",
              "REB",
              "AST",
              "AP%",
              "3P%",
              "LL%",
              "EF",
              "+/-",
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const totals = item.advancedTotals;
            return (
              <tr key={item.context.competitionId}>
                <th scope="row">
                  <Link to={contextPath(item.context, "jogadores", playerSlug)}>
                    {item.context.year} · {item.context.category.name}
                  </Link>
                </th>
                <td>{item.teamAbbreviation ?? item.teamName ?? "—"}</td>
                <td>{item.games}</td>
                <td>
                  {number(
                    totals ? modeValue(totals.secondsPlayed / 60, item.advancedGames, mode) : null,
                  )}
                </td>
                <td>{number(modeValue(item.officialPoints, item.games, mode))}</td>
                <td>
                  {number(
                    totals
                      ? modeValue(
                          totals.offensiveRebounds + totals.defensiveRebounds,
                          item.advancedGames,
                          mode,
                        )
                      : null,
                  )}
                </td>
                <td>
                  {number(totals ? modeValue(totals.assists, item.advancedGames, mode) : null)}
                </td>
                <td>{number(totals ? fieldPercentage(totals) : null, "%")}</td>
                <td>
                  {number(
                    totals ? percentage(totals.threePointMade, totals.threePointAttempted) : null,
                    "%",
                  )}
                </td>
                <td>
                  {number(
                    totals ? percentage(totals.freeThrowMade, totals.freeThrowAttempted) : null,
                    "%",
                  )}
                </td>
                <td>
                  {number(totals ? modeValue(efficiency(totals), item.advancedGames, mode) : null)}
                </td>
                <td>
                  {number(totals ? modeValue(totals.plusMinus, item.advancedGames, mode) : null)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollableTable>
  );
}

function PlayerGamesTable({ games }: { games: PublicPlayerGame[] }) {
  if (!games.length) return null;
  return (
    <ScrollableTable label="Jogos do atleta">
      <table className="statistics-table player-games-table">
        <caption>Jogos mais recentes</caption>
        <thead>
          <tr>
            {["Data", "Adversário", "Resultado", "PTS", "2PC", "3PC", "LLC", "F", "GD"].map(
              (label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {games.map((game) => {
            const scoresheet = game.kind === "scoresheet" ? game : null;
            const boxscore = game.kind === "boxscore" ? game : null;
            const advanced = boxscore?.advancedTotals;
            return (
              <tr key={game.id}>
                <th scope="row">
                  <Link to={contextPath(game.context, "jogos", game.id)}>
                    {dateLabel(game.scheduledAt)}
                  </Link>
                </th>
                <td>{game.opponentName ?? "—"}</td>
                <td>
                  {game.didNotPlay ? (
                    <strong>DNP</strong>
                  ) : (
                    <span data-result={game.result}>
                      {game.result}
                      {game.score ? ` · ${game.score}` : ""}
                    </span>
                  )}
                </td>
                <td>
                  {number(
                    game.didNotPlay
                      ? null
                      : (scoresheet?.points ?? boxscore?.officialPoints ?? null),
                  )}
                </td>
                <td>{number(scoresheet?.twoPointMade ?? advanced?.twoPointMade ?? null)}</td>
                <td>{number(scoresheet?.threePointMade ?? advanced?.threePointMade ?? null)}</td>
                <td>{number(scoresheet?.freeThrowMade ?? advanced?.freeThrowMade ?? null)}</td>
                <td>{number(scoresheet?.fouls ?? boxscore?.fouls ?? null)}</td>
                <td>{number(scoresheet?.disqualifications ?? null)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollableTable>
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
  const [mode, setMode] = useState<ProfileMode>("per-game");
  const listPath = `${contextPath(context, "jogadores")}${searchParams.size ? `?${searchParams}` : ""}`;
  const compareParams = new URLSearchParams(searchParams);
  compareParams.set("compare", `${profile.id},`);
  const comparePath = `${contextPath(context, "jogadores")}?${compareParams}`;
  const current = profile.current;
  const scoresheetCompetitions = profile.competitions.filter(
    (item): item is ScoresheetPlayerCompetitionSummary => item.kind === "scoresheet",
  );
  const boxscoreCompetitions = profile.competitions.filter(
    (item): item is BoxscorePlayerCompetitionSummary => item.kind === "boxscore",
  );
  const age = profile.birthYear ? new Date().getFullYear() - profile.birthYear : null;
  const headerFields = [
    current?.jerseyNumber ? ["Número", current.jerseyNumber] : null,
    (current?.position ?? profile.mainPosition)
      ? ["Posição", current?.position ?? profile.mainPosition]
      : null,
    ["Categoria", context.category.name],
    current?.teamName ? ["Equipe", current.teamName] : null,
    profile.heightCm ? ["Altura", `${profile.heightCm} cm`] : null,
    age !== null ? ["Idade", `${age} anos`] : null,
    profile.hand ? ["Lateralidade", profile.hand] : null,
  ].filter((item): item is string[] => item !== null);

  return (
    <article className="player-profile">
      <Link className="back-link" to={listPath}>
        ← Voltar para Jogadores
      </Link>
      <header className="player-profile-header">
        <div>
          <p className="eyebrow">{context.displayName}</p>
          <h1>{profile.fullName}</h1>
          {profile.nickname ? <p className="player-nickname">“{profile.nickname}”</p> : null}
          {profile.bio ? <p>{profile.bio}</p> : null}
          {context.statisticsMode === "boxscore" ? (
            <Link className="button button-primary compare-profile-action" to={comparePath}>
              Comparar jogador
            </Link>
          ) : null}
        </div>
        {headerFields.length ? (
          <dl className="player-public-fields">
            {headerFields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      <nav aria-label="Seções do perfil" className="player-profile-nav">
        {profileSections.map(([id, label]) => (
          <a href={`#${id}`} key={id}>
            {label}
          </a>
        ))}
      </nav>

      <section className="player-profile-section" id="resumo">
        <p className="eyebrow">
          {context.series.name} · {context.year} · {context.category.name}
        </p>
        <h2>Resumo</h2>
        {current?.games ? (
          <>
            {current.kind === "scoresheet" ? (
              <ScoresheetMetrics summary={current} />
            ) : (
              <BoxscoreMetrics summary={current} />
            )}
            <RecentProduction games={profile.games} />
            {current.kind === "boxscore" && current.advancedTotals ? (
              <section aria-labelledby="profile-detail-title" className="player-detail-metrics">
                <h3 id="profile-detail-title">Detalhamento avançado</h3>
                <p>
                  Cobertura avançada em {current.advancedGames} de {current.games} jogos.
                </p>
                <dl>
                  {[
                    [
                      "MIN",
                      number(
                        perGame(current.advancedTotals.secondsPlayed / 60, current.advancedGames),
                      ),
                    ],
                    [
                      "RO/RD",
                      `${number(perGame(current.advancedTotals.offensiveRebounds, current.advancedGames))}/${number(perGame(current.advancedTotals.defensiveRebounds, current.advancedGames))}`,
                    ],
                    [
                      "BR/TO",
                      `${number(perGame(current.advancedTotals.steals, current.advancedGames))}/${number(perGame(current.advancedTotals.blocks, current.advancedGames))}`,
                    ],
                    [
                      "ER/FC",
                      `${number(perGame(current.advancedTotals.turnovers, current.advancedGames))}/${number(current.fouls === null ? null : perGame(current.fouls, current.games))}`,
                    ],
                    [
                      "3P%",
                      number(
                        percentage(
                          current.advancedTotals.threePointMade,
                          current.advancedTotals.threePointAttempted,
                        ),
                        "%",
                      ),
                    ],
                    [
                      "LL%",
                      number(
                        percentage(
                          current.advancedTotals.freeThrowMade,
                          current.advancedTotals.freeThrowAttempted,
                        ),
                        "%",
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </>
        ) : (
          <ResourceState
            kind="empty"
            title="Sem estatísticas publicadas"
            detail="O atleta ainda não possui jogos finalizados nesta edição."
          />
        )}
        <AwardsAndHistory achievements={achievements} profile={profile} />
      </section>

      <section className="player-profile-section" id="estatisticas">
        <header className="profile-section-heading">
          <div>
            <p className="eyebrow">Por edição</p>
            <h2>Estatísticas</h2>
          </div>
          {boxscoreCompetitions.length ? (
            <fieldset className="segmented-control">
              <legend className="sr-only">Modo</legend>
              {(["per-game", "total"] as const).map((value) => (
                <label key={value}>
                  <input
                    checked={mode === value}
                    name="profile-mode"
                    onChange={() => setMode(value)}
                    type="radio"
                  />
                  <span>{value === "per-game" ? "Por jogo" : "Total"}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
        </header>
        {profile.competitions.length ? (
          <>
            <ScoresheetCompetitionTable items={scoresheetCompetitions} playerSlug={profile.slug} />
            <BoxscoreCompetitionTable
              items={boxscoreCompetitions}
              mode={mode}
              playerSlug={profile.slug}
            />
          </>
        ) : (
          <ResourceState
            kind="empty"
            title="Sem estatísticas publicadas"
            detail="O atleta ainda não possui jogos finalizados."
          />
        )}
      </section>

      <section className="player-profile-section" id="jogos">
        <p className="eyebrow">Participações publicadas</p>
        <h2>Jogos</h2>
        {profile.games.length ? (
          <PlayerGamesTable games={profile.games} />
        ) : (
          <ResourceState
            kind="empty"
            title="Nenhum jogo publicado"
            detail="Ainda não há participações em jogos iniciados ou finalizados."
          />
        )}
      </section>
    </article>
  );
}
