import { type ManualScoresheetV2Payload, periodLabel } from "./domain";
import type { ScoresheetRegistration } from "./editor";
import { savedScoresheetScore } from "./setup-revision";

export function SavedScoresheetSnapshot({
  payload,
  registrations,
}: {
  payload: ManualScoresheetV2Payload;
  registrations: ScoresheetRegistration[];
}) {
  return (
    <section aria-label="Conteúdo da versão salva">
      <h2>Dados salvos</h2>
      <dl>
        <dt>Data e horário</dt>
        <dd>
          {payload.game.date} {payload.game.time || "Horário não informado"}
        </dd>
        <dt>Local</dt>
        <dd>{payload.game.venue || "Não informado"}</dd>
        <dt>Número do jogo</dt>
        <dd>{payload.game.gameNumber || "Não informado"}</dd>
        <dt>Fase/rodada</dt>
        <dd>{payload.game.phaseRound || "Não informada"}</dd>
        <dt>Observações</dt>
        <dd>{payload.game.notes || "Nenhuma"}</dd>
        <dt>Placar</dt>
        <dd>{savedScoresheetScore(payload)}</dd>
      </dl>
      {payload.teams.map((team) => (
        <section key={team.side}>
          <h3>
            {team.side === "home" ? "Mandante" : "Visitante"}:{" "}
            {registrations.find((entry) => entry.id === team.registrationId)?.teamName ??
              team.registrationId}
          </h3>
          <ul>
            {team.slots.map((slot) => (
              <li key={slot.rosterEntryId}>
                #{slot.jerseyNumber} —{" "}
                {registrations
                  .flatMap((entry) => entry.roster)
                  .find((entry) => entry.rosterEntryId === slot.rosterEntryId)?.playerName ??
                  `Atleta ${slot.rosterEntryId}`}
                {slot.isStarter ? " (titular)" : ""}
                {slot.isCaptain ? " (capitão)" : ""}.{" "}
                {payload.periods
                  .map((period) => {
                    const stat = period.stats.find(
                      (entry) => entry.rosterEntryId === slot.rosterEntryId,
                    );
                    return `${periodLabel(period.periodNumber)}: 2PT ${stat?.twoPointMade ?? 0}, 3PT ${stat?.threePointMade ?? 0}, LL ${stat?.freeThrowMade ?? 0}`;
                  })
                  .join("; ")}
              </li>
            ))}
          </ul>
          <p>
            Comissão técnica:{" "}
            {team.staff
              ?.map(
                (entry) =>
                  `${entry.role === "coach" ? "Técnico" : "Assistente"}: ${entry.name}${entry.origin === "captain_placeholder" ? " (capitão)" : ""}`,
              )
              .join("; ") || "Não informada"}
          </p>
        </section>
      ))}
      <h3>Faltas (Q4 e OT agrupados)</h3>
      <ul>
        {payload.fouls.map((foul) => (
          <li key={`${foul.periodNumber}:${foul.sequenceNumber}`}>
            {periodLabel(foul.periodNumber)} · {foul.originalNotation} ·{" "}
            {foul.target.kind === "player"
              ? `Atleta ${foul.target.rosterEntryId}`
              : foul.target.kind === "staff"
                ? foul.target.staffRole === "coach"
                  ? "Técnico"
                  : "Assistente"
                : "Banco/equipe"}{" "}
            · Equipe {foul.target.registrationId}
          </li>
        ))}
      </ul>
      {!payload.fouls.length ? <p>Nenhuma falta registrada.</p> : null}
      <h3>Oficiais</h3>
      <p>
        {payload.officials.map((entry) => `${entry.role}: ${entry.name}`).join("; ") ||
          "Não informados"}
      </p>
    </section>
  );
}
