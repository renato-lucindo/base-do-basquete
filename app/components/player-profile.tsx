import { Link } from "react-router";
import { type CompetitionContext, contextPath } from "../modules/competition/context";
import type { PublicAchievement } from "../modules/competition/public-data.server";
import type { PublicPlayerProfileDto } from "../modules/statistics/player-profile.server";
import {
  type PlayerTotals,
  perGame,
  publicProfileValue,
} from "../modules/statistics/player-profile-domain";
import { ResourceState } from "./resource-state";
import { ScrollableTable } from "./scrollable-table";

const profileSections = [
  ["resumo", "Resumo"],
  ["estatisticas", "EstatÃ­sticas"],
  ["conquistas-honrarias", "Conquistas e honrarias"],
  ["jogos", "Jogos"],
  ["historico", "HistÃ³rico"],
] as const;

function average(value: number, games: number): string {
  const result = perGame(value, games);
  return result === null ? "â€”" : result.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function dateLabel(value: string | null): string {
  if (!value) return "Data nÃ£o informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function placementLabel(placement: number, resultLabel: string | null): string {
  if (resultLabel) return resultLabel;
  return placement === 1 ? "CampeÃ£o" : `${placement}Âº lugar`;
}

function Summary({ label, totals }: { label: string; totals: PlayerTotals | null }) {
  return (
    <article className="player-summary-card">
      <h3>{label}</h3>
      {totals?.games ? (
        <dl>
          <div>
            <dt>Jogos</dt>
            <dd>{totals.games}</dd>
          </div>
          <div>
            <dt>Pontos</dt>
            <dd>{totals.points}</dd>
          </div>
          <div>
            <dt>PPJ</dt>
            <dd>{average(totals.points, totals.games)}</dd>
          </div>
          <div>
            <dt>AssistÃªncias/jogo</dt>
            <dd>{average(totals.assists, totals.games)}</dd>
          </div>
          <div>
            <dt>Rebotes/jogo</dt>
            <dd>{average(totals.rebounds, totals.games)}</dd>
          </div>
        </dl>
      ) : (
        <p>Sem jogos finalizados para calcular estatÃ­sticas.</p>
      )}
    </article>
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
  const location = [profile.homeCity, profile.homeState].filter(Boolean).join(" Â· ");
  return (
    <article className="player-profile">
      <header className="player-profile-header">
        <div>
          <p className="eyebrow">Perfil pÃºblico Â· {context.displayName}</p>
          <h1>{profile.fullName}</h1>
          <p className="player-nickname">
            {profile.nickname ? `â€œ${profile.nickname}â€` : "Apelido nÃ£o informado"}
          </p>
          <p>{profile.bio ?? "Biografia ainda nÃ£o informada."}</p>
        </div>
        <dl className="player-public-fields">
          <div>
            <dt>Ano de nascimento</dt>
            <dd>{publicProfileValue(profile.birthYear)}</dd>
          </div>
          <div>
            <dt>Altura</dt>
            <dd>{profile.heightCm ? `${profile.heightCm} cm` : "NÃ£o informada"}</dd>
          </div>
          <div>
            <dt>Peso</dt>
            <dd>{profile.weightKg ? `${profile.weightKg} kg` : "NÃ£o informado"}</dd>
          </div>
          <div>
            <dt>PosiÃ§Ã£o</dt>
            <dd>{publicProfileValue(profile.mainPosition)}</dd>
          </div>
          <div>
            <dt>MÃ£o dominante</dt>
            <dd>{publicProfileValue(profile.hand)}</dd>
          </div>
          <div>
            <dt>Origem</dt>
            <dd>{location || "NÃ£o informada"}</dd>
          </div>
        </dl>
      </header>

      <nav aria-label="SeÃ§Ãµes do perfil" className="player-profile-nav">
        {profileSections.map(([id, label]) => (
          <a href={`#${id}`} key={id}>
            {label}
          </a>
        ))}
      </nav>

      <section className="player-profile-section" id="resumo">
        <p className="eyebrow">VisÃ£o geral</p>
        <h2>Resumo</h2>
        <div className="player-summary-grid">
          <Summary label="EdiÃ§Ã£o atual" totals={profile.current} />
          <Summary label="Carreira publicada" totals={profile.career} />
        </div>
      </section>

      <section className="player-profile-section" id="estatisticas">
        <p className="eyebrow">Por ediÃ§Ã£o</p>
        <h2>EstatÃ­sticas</h2>
        {profile.competitions.length ? (
          <ScrollableTable label="EstatÃ­sticas do atleta por ediÃ§Ã£o">
            <table className="statistics-table">
              <caption>Totais e mÃ©dias somente de jogos finalizados</caption>
              <thead>
                <tr>
                  <th scope="col">EdiÃ§Ã£o</th>
                  <th scope="col">Equipe</th>
                  <th scope="col">J</th>
                  <th scope="col">Tit.</th>
                  <th scope="col">PTS</th>
                  <th scope="col">PPJ</th>
                  <th scope="col">REB/J</th>
                  <th scope="col">AST/J</th>
                </tr>
              </thead>
              <tbody>
                {profile.competitions.map((item) => (
                  <tr key={item.context.competitionId}>
                    <th scope="row">
                      <Link to={contextPath(item.context, "jogadores", profile.slug)}>
                        {item.context.year} Â· {item.context.category.name}
                      </Link>
                    </th>
                    <td>{item.teamName ?? "â€”"}</td>
                    <td>{item.games}</td>
                    <td>{item.starterAppearances}</td>
                    <td>{item.points}</td>
                    <td>{average(item.points, item.games)}</td>
                    <td>{average(item.rebounds, item.games)}</td>
                    <td>{average(item.assists, item.games)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        ) : (
          <ResourceState
            kind="empty"
            title="Sem estatÃ­sticas publicadas"
            detail="O atleta estÃ¡ inscrito, mas ainda nÃ£o possui jogos finalizados."
          />
        )}
      </section>

      <section className="player-profile-section" id="conquistas-honrarias">
        <p className="eyebrow">Resultados confirmados</p>
        <h2>Conquistas e honrarias</h2>
        {achievements.length || profile.honors.length ? (
          <div className="player-awards-grid">
            {achievements.map((achievement) => (
              <article key={`achievement-${achievement.competitionId}-${achievement.teamSlug}`}>
                <span>Conquista coletiva</span>
                <h3>{placementLabel(achievement.placement, achievement.resultLabel)}</h3>
                <p>
                  {achievement.year} Â· {achievement.seriesName} Â· {achievement.categoryName}
                </p>
              </article>
            ))}
            {profile.honors.map((honor) => (
              <article key={`honor-${honor.id}`}>
                <span>Honraria individual</span>
                <h3>{honor.title}</h3>
                <p>
                  {[honor.year, honor.competitionName].filter(Boolean).join(" Â· ") ||
                    "Sem ediÃ§Ã£o vinculada"}
                </p>
                {honor.description ? <p>{honor.description}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <ResourceState
            kind="empty"
            title="Nenhuma conquista confirmada"
            detail="Somente resultados e honrarias confirmados sÃ£o exibidos publicamente."
          />
        )}
      </section>

      <section className="player-profile-section" id="jogos">
        <p className="eyebrow">ParticipaÃ§Ãµes publicadas</p>
        <h2>Jogos</h2>
        {profile.games.length ? (
          <ol className="player-game-list">
            {profile.games.map((game) => (
              <li key={game.id}>
                <div>
                  <strong>{game.label}</strong>
                  <span>
                    {dateLabel(game.scheduledAt)} Â· {game.context.displayName}
                  </span>
                </div>
                <span>
                  {game.teamName ?? "Equipe nÃ£o informada"} Â· camisa {game.jerseyNumber ?? "â€”"} Â·{" "}
                  {game.points} pts
                </span>
                <Link to={contextPath(game.context, "jogos", game.id)}>Abrir jogo</Link>
              </li>
            ))}
          </ol>
        ) : (
          <ResourceState
            kind="empty"
            title="Nenhum jogo publicado"
            detail="A inscriÃ§Ã£o estÃ¡ confirmada, mas ainda nÃ£o hÃ¡ participaÃ§Ãµes em jogos iniciados ou finalizados."
          />
        )}
      </section>

      <section className="player-profile-section" id="historico">
        <p className="eyebrow">TrajetÃ³ria publicada</p>
        <h2>HistÃ³rico</h2>
        {profile.competitions.length ? (
          <ol className="player-history">
            {profile.competitions.map((item) => (
              <li key={item.context.competitionId}>
                <strong>
                  {item.context.year} Â· {item.context.series.name} Â· {item.context.category.name}
                </strong>
                <span>
                  {item.teamName ?? "Equipe nÃ£o informada"} Â· camisa {item.jerseyNumber ?? "â€”"} Â·{" "}
                  {item.position ?? profile.mainPosition ?? "posiÃ§Ã£o nÃ£o informada"}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>Sem histÃ³rico de jogos finalizados.</p>
        )}
      </section>
    </article>
  );
}

