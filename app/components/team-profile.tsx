import { Link } from "react-router";

import {
  type CompetitionContext,
  contextPath,
  genderDivisionSlug,
} from "../modules/competition/context";
import type { PublicAchievement } from "../modules/competition/public-data.server";
import type { PublicTeamProfileDto } from "../modules/competition/public-route-data.server";
import type { PublicGameSummary } from "../modules/statistics/sports-domain";
import { ResourceState } from "./resource-state";

function number(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(".", ",")}${suffix}`;
}

function dateTime(value: string | null): string {
  if (!value) return "Data e horário a definir";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function placementLabel(achievement: PublicAchievement): string {
  if (achievement.resultLabel) return achievement.resultLabel;
  return achievement.placement === 1 ? "Campeão" : `${achievement.placement}º lugar`;
}

function teamGameResult(game: PublicGameSummary, teamId: number): string {
  if (game.status === "scheduled") return "Agendado";
  if (game.status === "live") return "Em andamento";
  if (game.homeScore === null || game.awayScore === null) return "Finalizado";
  const teamScore = game.home.id === teamId ? game.homeScore : game.awayScore;
  const opponentScore = game.home.id === teamId ? game.awayScore : game.homeScore;
  if (teamScore === opponentScore) return "Empate";
  return teamScore > opponentScore ? "Vitória" : "Derrota";
}

export function TeamProfile({
  achievements,
  context,
  profile,
}: {
  achievements: PublicAchievement[];
  context: CompetitionContext;
  profile: PublicTeamProfileDto;
}) {
  const { standing, statistics, team } = profile;
  return (
    <article className="team-profile">
      <header className="team-profile-header">
        <div>
          <p className="eyebrow">{context.displayName}</p>
          <h1>{team.name}</h1>
          {team.abbreviation ? <p className="team-abbreviation">{team.abbreviation}</p> : null}
        </div>
        <Link className="team-classification-link" to={contextPath(context, "classificacao")}>
          Ver classificação
        </Link>
      </header>

      <section aria-labelledby="team-summary-title" className="team-profile-section">
        <div className="team-section-heading">
          <p className="eyebrow">Edição atual</p>
          <h2 id="team-summary-title">Resumo competitivo</h2>
        </div>
        {standing ? (
          <dl className="team-summary-grid">
            <div>
              <dt>Posição</dt>
              <dd>{standing.position}º</dd>
            </div>
            <div>
              <dt>Jogos</dt>
              <dd>{standing.games}</dd>
            </div>
            <div>
              <dt>Vitórias</dt>
              <dd>{standing.wins}</dd>
            </div>
            <div>
              <dt>Derrotas</dt>
              <dd>{standing.losses}</dd>
            </div>
            <div>
              <dt>Aproveitamento</dt>
              <dd>{number(standing.winPercentage, "%")}</dd>
            </div>
            <div>
              <dt>Saldo</dt>
              <dd>{standing.pointDifference}</dd>
            </div>
          </dl>
        ) : (
          <ResourceState
            detail="A posição será exibida após a publicação da classificação."
            kind="empty"
            title="Resumo ainda indisponível"
          />
        )}
      </section>

      {statistics ? (
        <section aria-labelledby="team-performance-title" className="team-profile-section">
          <div className="team-section-heading">
            <p className="eyebrow">Médias por jogo</p>
            <h2 id="team-performance-title">Desempenho</h2>
          </div>
          <dl className="team-performance-grid">
            <div>
              <dt>Pontos</dt>
              <dd>{number(statistics.pointsPerGame)}</dd>
            </div>
            <div>
              <dt>Rebotes</dt>
              <dd>{number(statistics.reboundsPerGame)}</dd>
            </div>
            <div>
              <dt>Assistências</dt>
              <dd>{number(statistics.assistsPerGame)}</dd>
            </div>
            <div>
              <dt>Arremessos</dt>
              <dd>{number(statistics.fieldGoalPercentage, "%")}</dd>
            </div>
            <div>
              <dt>3 pontos</dt>
              <dd>{number(statistics.threePointPercentage, "%")}</dd>
            </div>
            <div>
              <dt>Lances livres</dt>
              <dd>{number(statistics.freeThrowPercentage, "%")}</dd>
            </div>
            <div>
              <dt>Eficiência</dt>
              <dd>{number(statistics.efficiencyPerGame)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="team-games-title" className="team-profile-section">
        <div className="team-section-heading">
          <p className="eyebrow">Agenda e resultados</p>
          <h2 id="team-games-title">Jogos</h2>
        </div>
        {profile.games.length ? (
          <ol className="team-game-list">
            {profile.games.map((game) => {
              const opponent = game.home.id === team.id ? game.away : game.home;
              return (
                <li key={game.id}>
                  <div>
                    <span>{teamGameResult(game, team.id)}</span>
                    <strong>contra {opponent.name}</strong>
                    <p>
                      {dateTime(game.scheduledAt)} · {game.venue ?? "Local a definir"}
                    </p>
                  </div>
                  <div className="team-game-action">
                    <strong>
                      {game.status === "scheduled" ||
                      game.homeScore === null ||
                      game.awayScore === null
                        ? "—"
                        : `${game.homeScore} × ${game.awayScore}`}
                    </strong>
                    <Link to={contextPath(context, "jogos", game.id)}>Abrir partida</Link>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <ResourceState
            detail="Os jogos aparecerão quando forem publicados nesta edição."
            kind="empty"
            title="Nenhum jogo publicado"
          />
        )}
      </section>

      <section aria-labelledby="team-achievements-title" className="team-profile-section">
        <div className="team-section-heading">
          <p className="eyebrow">Histórico confirmado</p>
          <h2 id="team-achievements-title">Conquistas</h2>
        </div>
        {achievements.length ? (
          <ol className="team-achievement-list">
            {achievements.map((achievement) => {
              const genderSegment = achievement.genderDivision
                ? `/${genderDivisionSlug(achievement.genderDivision)}`
                : "";
              const editionPath = `/${achievement.year}/${achievement.seriesSlug}/${achievement.categorySlug}${genderSegment}/classificacao`;
              return (
                <li key={achievement.competitionId}>
                  <strong>{placementLabel(achievement)}</strong>
                  <span>
                    {achievement.year} · {achievement.seriesName} · {achievement.categoryName}
                  </span>
                  <Link to={editionPath}>Abrir edição</Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="team-empty-copy">Nenhuma conquista confirmada.</p>
        )}
      </section>
    </article>
  );
}
