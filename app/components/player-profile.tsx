import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import {
  type CompetitionContext,
  contextPath,
  genderDivisionLabel,
} from "../modules/competition/context";
import type { PublicAchievement } from "../modules/competition/public-data.server";
import type { PublicPlayerProfileDto } from "../modules/statistics/player-profile.server";
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

function modeValue(value: number, totals: PlayerTotals, mode: ProfileMode): number | null {
  return mode === "total" ? value : perGame(value, totals.games);
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

function Metrics({ mode, totals }: { mode: ProfileMode; totals: PlayerTotals }) {
  const metrics = [
    ["PTS", modeValue(totals.points, totals, mode)],
    ["REB", modeValue(totals.offensiveRebounds + totals.defensiveRebounds, totals, mode)],
    ["AST", modeValue(totals.assists, totals, mode)],
    ["AP%", fieldPercentage(totals)],
    ["EF", modeValue(efficiency(totals), totals, mode)],
    ["+/-", modeValue(totals.plusMinus, totals, mode)],
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

function RecentProduction({ games }: { games: PublicPlayerProfileDto["games"] }) {
  const recent = games.slice(0, 5).reverse();
  if (recent.length < 3) return null;
  const maximum = Math.max(...recent.map((game) => game.totals.points), 1);
  const text = recent.map((game) => `${game.label}: ${game.totals.points} pontos`).join("; ");
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
            <span style={{ height: `${Math.max(8, (game.totals.points / maximum) * 100)}%` }} />
            <strong>{game.totals.points}</strong>
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
          <Link className="button button-primary compare-profile-action" to={comparePath}>
            Comparar jogador
          </Link>
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
            <Metrics mode="per-game" totals={current} />
            <RecentProduction games={profile.games} />
            <section aria-labelledby="profile-detail-title" className="player-detail-metrics">
              <h3 id="profile-detail-title">Detalhamento</h3>
              <dl>
                {[
                  ["MIN", number(perGame(current.secondsPlayed / 60, current.games))],
                  [
                    "RO/RD",
                    `${number(perGame(current.offensiveRebounds, current.games))}/${number(perGame(current.defensiveRebounds, current.games))}`,
                  ],
                  [
                    "BR/TO",
                    `${number(perGame(current.steals, current.games))}/${number(perGame(current.blocks, current.games))}`,
                  ],
                  [
                    "ER/FC",
                    `${number(perGame(current.turnovers, current.games))}/${number(perGame(current.fouls, current.games))}`,
                  ],
                  [
                    "3P%",
                    number(percentage(current.threePointMade, current.threePointAttempted), "%"),
                  ],
                  [
                    "LL%",
                    number(percentage(current.freeThrowMade, current.freeThrowAttempted), "%"),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
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
        </header>
        {profile.competitions.length ? (
          <ScrollableTable label="Estatísticas do atleta por edição">
            <table className="statistics-table player-statistics-table">
              <caption>Estatísticas por edição</caption>
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
                {profile.competitions.map((item) => (
                  <tr key={item.context.competitionId}>
                    <th scope="row">
                      <Link to={contextPath(item.context, "jogadores", profile.slug)}>
                        {item.context.year} · {item.context.category.name}
                      </Link>
                    </th>
                    <td>{item.teamAbbreviation ?? item.teamName ?? "—"}</td>
                    <td>{item.games}</td>
                    <td>{number(modeValue(item.secondsPlayed / 60, item, mode))}</td>
                    <td>{number(modeValue(item.points, item, mode))}</td>
                    <td>
                      {number(
                        modeValue(item.offensiveRebounds + item.defensiveRebounds, item, mode),
                      )}
                    </td>
                    <td>{number(modeValue(item.assists, item, mode))}</td>
                    <td>{number(fieldPercentage(item), "%")}</td>
                    <td>
                      {number(percentage(item.threePointMade, item.threePointAttempted), "%")}
                    </td>
                    <td>{number(percentage(item.freeThrowMade, item.freeThrowAttempted), "%")}</td>
                    <td>{number(modeValue(efficiency(item), item, mode))}</td>
                    <td>{number(modeValue(item.plusMinus, item, mode))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
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
          <ScrollableTable label="Jogos do atleta">
            <table className="statistics-table player-games-table">
              <caption>Jogos mais recentes</caption>
              <thead>
                <tr>
                  {[
                    "Data",
                    "Adversário",
                    "Resultado",
                    "MIN",
                    "PTS",
                    "REB",
                    "AST",
                    "AP%",
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
                {profile.games.map((game) => (
                  <tr key={game.id}>
                    <th scope="row">
                      <Link to={contextPath(game.context, "jogos", game.id)}>
                        {dateLabel(game.scheduledAt)}
                      </Link>
                    </th>
                    <td>{game.opponentName ?? "—"}</td>
                    <td>
                      <span data-result={game.result}>
                        {game.result}
                        {game.score ? ` · ${game.score}` : ""}
                      </span>
                    </td>
                    <td>{number(game.totals.secondsPlayed / 60)}</td>
                    <td>{game.totals.points}</td>
                    <td>{game.totals.offensiveRebounds + game.totals.defensiveRebounds}</td>
                    <td>{game.totals.assists}</td>
                    <td>{number(fieldPercentage(game.totals), "%")}</td>
                    <td>{efficiency(game.totals)}</td>
                    <td>{game.totals.plusMinus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
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
