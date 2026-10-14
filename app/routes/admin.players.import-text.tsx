import { useState } from "react";
import { parseTeamImportText } from "../modules/players/team-import-domain";

export function meta() {
  return [{ title: "Importar elenco por texto — Administração" }];
}

export default function PlayerTextImportPreview() {
  const [text, setText] = useState("Equipe: Lobos\n\n4- João\n12- Ricardo - 1999\n23- Mike - \"MJ\" - 2000 - SG\n77- Luke Silva - 180 - 75kg");
  const [players, setPlayers] = useState(() => parseTeamImportText(text));

  return (
    <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Teste de importação de elenco</h1>
      <p>Cole o texto do elenco e valide a interpretação antes da integração com o banco.</p>

      <label htmlFor="team-text">Texto do elenco</label>
      <textarea
        id="team-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={12}
        style={{ display: "block", width: "100%", marginTop: "0.5rem" }}
      />
      <button type="button" onClick={() => setPlayers(parseTeamImportText(text))}>
        Interpretar texto
      </button>

      <h2>Resultado</h2>
      <div style={{ overflowX: "auto", marginTop: "1rem" }}>
      <table>
        <thead>
          <tr>
            <th>Nº</th>
            <th>Nome</th>
            <th>Apelido</th>
            <th>Altura</th>
            <th>Posição</th>
            <th>Nascimento</th>
            <th>Peso</th>
            <th>Mão dominante</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={`${player.name}-${player.jerseyNumber}`}>
              <td>{player.jerseyNumber ?? "-"}</td>
              <td>{player.name}</td>
              <td>{player.nickname ?? "-"}</td>
                <td>{player.heightCm ? `${player.heightCm} cm` : "-"}</td>
              <td>{player.positions.join(", ") || "-"}</td>
              <td>{player.birthDate ?? player.birthYear ?? "-"}</td>
              <td>{player.weightKg ? `${player.weightKg}kg` : "-"}</td>
              <td>{player.dominantHand ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </main>
  );
}
