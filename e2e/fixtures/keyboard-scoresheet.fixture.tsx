import { createRoot } from "react-dom/client";
import {
  type KeyboardContext,
  KeyboardScoresheet,
} from "../../app/modules/keyboard-scoresheet/editor";
import type { SaveRequest } from "../../app/modules/keyboard-scoresheet/server";
import "../../app/app.css";

const initial: KeyboardContext = {
  gameId: 990,
  title: "Jogo de teste",
  teams: { home: "Equipe Azul", away: "Equipe Verde" },
  version: 1,
  confirmed: false,
  candidates: [
    { rosterEntryId: 1, registrationId: 10, side: "home", jersey: "12", name: "Ana" },
    { rosterEntryId: 2, registrationId: 20, side: "away", jersey: "12", name: "Bia" },
  ],
  initial: {
    rulesVersion: "FIBA_2024",
    periods: 4,
    coachPlayer: { home: null, away: null },
    roster: [
      { rosterEntryId: 1, registrationId: 10, side: "home", jersey: "12", played: true },
      { rosterEntryId: 2, registrationId: 20, side: "away", jersey: "12", played: true },
    ],
    events: [],
  },
};
const params = new URLSearchParams(location.search);
if (params.has("setup")) initial.version = 0;
const saved = sessionStorage.getItem("keyboard-server");
if (saved) Object.assign(initial, JSON.parse(saved));
const receipts = new Map<string, { version: number; confirmed: boolean; requestId: string }>();
let serverVersion = initial.version;
async function save(request: SaveRequest) {
  await new Promise((resolve) => setTimeout(resolve, 40));
  if (params.has("fail")) throw new Error("Falha de rede simulada. Tente novamente.");
  const receipt = receipts.get(request.requestId);
  if (receipt) return receipt;
  if (request.baseVersion !== serverVersion) throw new Error("Conflito de versão");
  serverVersion++;
  const result = {
    version: serverVersion,
    confirmed: request.confirm,
    requestId: request.requestId,
  };
  receipts.set(request.requestId, result);
  sessionStorage.setItem(
    "keyboard-server",
    JSON.stringify({
      version: serverVersion,
      initial: request.document,
      confirmed: request.confirm || initial.confirmed,
    }),
  );
  return result;
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(
  <main>
    <KeyboardScoresheet context={initial} onSave={save} />
  </main>,
);
