export function normalizeTeamCreationInput(nameValue: unknown, abbreviationValue: unknown) {
  const name = String(nameValue ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const abbreviation = String(abbreviationValue ?? "")
    .trim()
    .toUpperCase();
  if (name.length < 2 || name.length > 120) {
    return { ok: false as const, error: "Informe um nome entre 2 e 120 caracteres." };
  }
  if (abbreviation && !/^[A-Z0-9]{2,8}$/.test(abbreviation)) {
    return { ok: false as const, error: "A sigla deve ter de 2 a 8 letras ou números." };
  }
  return {
    ok: true as const,
    input: { name, abbreviation: abbreviation || null },
  };
}

export function parseTeamSelection(value: unknown): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  const match = /^([1-9][0-9]*)(?=\s*(?:—|-|$))/.exec(text);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}
