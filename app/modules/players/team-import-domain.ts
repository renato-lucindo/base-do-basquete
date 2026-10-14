export interface ImportedTeamPlayer {
  jerseyNumber: string | null;
  federationRegistration: string | null;
  name: string;
  nickname: string | null;
  birthDate: string | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  positions: string[];
  dominantHand: "Direita" | "Esquerda" | null;
}

const positions: Record<string, string> = {
  pg: "Armador",
  "point guard": "Armador",
  armador: "Armador",
  sg: "Ala Armador",
  "shooting guard": "Ala Armador",
  "ala armador": "Ala Armador",
  sf: "Ala",
  "small forward": "Ala",
  ala: "Ala",
  pf: "Ala Pivô",
  "power forward": "Ala Pivô",
  "ala pivo": "Ala Pivô",
  c: "Pivô",
  center: "Pivô",
  pivo: "Pivô",
};

export function normalizePosition(value: string): string | null {
  return positions[normalize(value)] ?? null;
}

export function parseTeamImportText(text: string): ImportedTeamPlayer[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith("equipe:"))
    .filter((line) => !/^n[ºo]?\s*-?\s*nome/i.test(line))
    .map(parsePlayerLine);
}

function parsePlayerLine(line: string): ImportedTeamPlayer {
  const parts = line.split(/\s*-\s*/).map((part) => part.trim());
  const first = parts.shift() ?? "";
  const jerseyNumber = first.match(/^\d{1,3}$/)?.[0] ?? null;
  const name = jerseyNumber ? parts.shift() ?? "" : first.replace(/^-/, "").trim();

  const result: ImportedTeamPlayer = {
    jerseyNumber,
    federationRegistration: null,
    name,
    nickname: null,
    birthDate: null,
    birthYear: null,
    heightCm: null,
    weightKg: null,
    positions: [],
    dominantHand: null,
  };

  for (const part of parts) {
    const normalized = part.toLowerCase();
    if (/^\d{6}$/.test(part)) result.federationRegistration = part;
    else if (/^\d{4}$/.test(part)) result.birthYear = Number(part);
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(part)) {
      const dateParts = part.split("/");
      const day = dateParts[0] ?? "";
      const month = dateParts[1] ?? "";
      const year = dateParts[2] ?? "";
      result.birthDate = `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
    else if (/^[1-5](?:-[1-5])?$/.test(part)) result.positions.push(...mapNumericPositions(part));
    else if (/^\d+(?:[,.]\d+)?$/.test(normalized)) {
      const height = Number(normalized.replace(",", "."));
      if (height >= 1 && height < 3) result.heightCm = Math.round(height * 100);
    }
    else if (/^\d+\s*kg$/.test(normalized)) result.weightKg = Number.parseInt(part, 10);
    else if (["canhoto", "esquerda"].includes(normalized)) result.dominantHand = "Esquerda";
    else if (["direita"].includes(normalized)) result.dominantHand = "Direita";
    else if (normalizePosition(part)) result.positions.push(normalizePosition(part)!);
    else if (part.startsWith('"') && part.endsWith('"')) result.nickname = part.slice(1, -1);
  }

  result.positions = [...new Set(result.positions)].slice(0, 2);
  return result;
}

function mapNumericPositions(value: string): string[] {
  const map: Record<string, string> = {
    "1": "Armador",
    "2": "Ala Armador",
    "3": "Ala",
    "4": "Ala Pivô",
    "5": "Pivô",
  };

  return value.split("-").flatMap((item) => {
    const position = map[item];
    return position ? [position] : [];
  });
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
