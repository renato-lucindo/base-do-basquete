/** Pure preset compiler. Persistence must independently enforce these contracts in SQL. */
export const PRESET_VERSION = 1;
export const MAX_PRESET_ENTRIES = 16;
export type PresetKey = "single_group" | "single_elimination";
export type RoundRole = "round_robin" | "round_of_16" | "quarterfinal" | "semifinal" | "final";
export type SlotOrigin = { kind: "entry"; seed: number } | { kind: "winner"; matchupCode: string };

export interface PresetMatchup {
  code: string;
  home: SlotOrigin;
  away: SlotOrigin;
  format: "single_game";
  maxGames: 1;
}
export interface PresetRound {
  code: string;
  order: number;
  role: RoundRole;
  capacity: number;
  maxMatchups: number;
  byes: number[];
  matchups: PresetMatchup[];
}
export interface CompiledPreset {
  key: PresetKey;
  version: 1;
  entryCount: number;
  track: { code: "main" };
  stage: { code: "league" | "knockout"; kind: "round_robin" | "knockout" };
  group: { code: "single_group" } | null;
  rounds: PresetRound[];
}
export type PresetErrorCode =
  | "invalid-preset"
  | "invalid-entry-count"
  | "invalid-hierarchy"
  | "invalid-round"
  | "invalid-matchup"
  | "invalid-source"
  | "source-reused"
  | "incomplete-structure";
export class PresetError extends Error {
  constructor(public readonly code: PresetErrorCode) {
    super(code);
    this.name = "PresetError";
  }
}

const knockoutContracts = {
  round_of_16: { capacity: 16, maxMatchups: 8 },
  quarterfinal: { capacity: 8, maxMatchups: 4 },
  semifinal: { capacity: 4, maxMatchups: 2 },
  final: { capacity: 2, maxMatchups: 1 },
} as const;

function fail(code: PresetErrorCode): never {
  throw new PresetError(code);
}
function entry(seed: number): SlotOrigin {
  return { kind: "entry", seed };
}
function matchup(code: string, home: SlotOrigin, away: SlotOrigin): PresetMatchup {
  return { code, home, away, format: "single_game", maxGames: 1 };
}
function roleForCapacity(capacity: number): Exclude<RoundRole, "round_robin"> {
  if (capacity === 16) return "round_of_16";
  if (capacity === 8) return "quarterfinal";
  if (capacity === 4) return "semifinal";
  if (capacity === 2) return "final";
  return fail("invalid-round");
}

/** Only the versioned keys and explicit entry count are accepted, never a display name. */
export function compilePreset(key: unknown, entryCount: unknown): CompiledPreset {
  if (key !== "single_group" && key !== "single_elimination") fail("invalid-preset");
  if (
    typeof entryCount !== "number" ||
    !Number.isInteger(entryCount) ||
    entryCount < 2 ||
    entryCount > MAX_PRESET_ENTRIES
  ) {
    fail("invalid-entry-count");
  }
  const result: CompiledPreset = {
    key,
    version: PRESET_VERSION,
    entryCount,
    track: { code: "main" },
    stage: {
      code: key === "single_group" ? "league" : "knockout",
      kind: key === "single_group" ? "round_robin" : "knockout",
    },
    group: key === "single_group" ? { code: "single_group" } : null,
    rounds: [],
  };
  if (key === "single_group") {
    // Circle method. Zero is an internal empty position, never a participant or game.
    const positions = Array.from({ length: entryCount }, (_, index) => index + 1);
    if (entryCount % 2 === 1) positions.push(0);
    for (let order = 1; order < positions.length; order += 1) {
      const round: PresetRound = {
        code: `round_${order}`,
        order,
        role: "round_robin",
        capacity: entryCount,
        maxMatchups: Math.floor(entryCount / 2),
        byes: [],
        matchups: [],
      };
      for (let index = 0; index < positions.length / 2; index += 1) {
        const left = positions[index];
        const right = positions[positions.length - 1 - index];
        if (left === undefined || right === undefined) fail("invalid-source");
        if (left === 0 || right === 0) {
          round.byes.push(left || right);
        } else {
          round.matchups.push(
            matchup(`${round.code}_match_${index + 1}`, entry(left), entry(right)),
          );
        }
      }
      result.rounds.push(round);
      const last = positions.pop();
      if (last !== undefined) positions.splice(1, 0, last);
    }
  } else {
    const size = 2 ** Math.ceil(Math.log2(entryCount));
    let seeds = [1, 2];
    for (let capacity = 4; capacity <= size; capacity *= 2) {
      seeds = seeds.flatMap((seed) => [seed, capacity + 1 - seed]);
    }
    let sources: Array<SlotOrigin | null> = seeds.map((seed) =>
      seed <= entryCount ? entry(seed) : null,
    );
    for (let capacity = size; capacity >= 2; capacity /= 2) {
      const role = roleForCapacity(capacity);
      const round: PresetRound = {
        code: role,
        order: result.rounds.length + 1,
        role,
        ...knockoutContracts[role],
        byes: [],
        matchups: [],
      };
      const next: SlotOrigin[] = [];
      for (let index = 0; index < sources.length; index += 2) {
        const home = sources[index];
        const away = sources[index + 1];
        if (home && away) {
          const code = `${role}_match_${index / 2 + 1}`;
          round.matchups.push(matchup(code, home, away));
          next.push({ kind: "winner", matchupCode: code });
        } else {
          const source = home ?? away;
          if (!source || source.kind !== "entry") fail("invalid-source");
          round.byes.push(source.seed);
          next.push(source);
        }
      }
      result.rounds.push(round);
      sources = next;
    }
  }
  validateCompiledPreset(result);
  return result;
}

/** Cross-row/domain checks; the database remains authoritative for writes and concurrency. */
export function validateCompiledPreset(preset: CompiledPreset): void {
  const { key, entryCount, rounds } = preset;
  if (key !== "single_group" && key !== "single_elimination") fail("invalid-preset");
  if (!Number.isInteger(entryCount) || entryCount < 2 || entryCount > MAX_PRESET_ENTRIES) {
    fail("invalid-entry-count");
  }
  const league = key === "single_group";
  if (
    preset.version !== PRESET_VERSION ||
    preset.track.code !== "main" ||
    preset.stage.code !== (league ? "league" : "knockout") ||
    preset.stage.kind !== (league ? "round_robin" : "knockout") ||
    (league ? preset.group?.code !== "single_group" : preset.group !== null)
  ) {
    fail("invalid-hierarchy");
  }
  const size = 2 ** Math.ceil(Math.log2(entryCount));
  const expectedRounds = league ? entryCount - 1 + (entryCount % 2) : Math.log2(size);
  if (rounds.length !== expectedRounds) fail("incomplete-structure");
  const previousMatches = new Set<string>();
  const consumedSources = new Set<string>();
  const pairs = new Set<string>();
  const roundCodes = new Set<string>();
  let total = 0;
  for (const [index, round] of rounds.entries()) {
    const expectedRole = league ? "round_robin" : roleForCapacity(size / 2 ** index);
    const capacity =
      expectedRole === "round_robin" ? entryCount : knockoutContracts[expectedRole].capacity;
    const maximum = Math.floor(capacity / 2);
    const expectedByes = league ? entryCount % 2 : index === 0 ? size - entryCount : 0;
    if (
      round.order !== index + 1 ||
      !/^[a-z][a-z0-9_]*$/.test(round.code) ||
      roundCodes.has(round.code) ||
      round.role !== expectedRole ||
      round.capacity !== capacity ||
      round.maxMatchups !== maximum ||
      round.byes.length !== expectedByes ||
      round.matchups.length !== maximum - (league ? 0 : expectedByes)
    ) {
      fail("invalid-round");
    }
    roundCodes.add(round.code);
    const localSources = new Set<string>();
    const roundMatches = new Set<string>();
    for (const seed of round.byes) {
      if (!Number.isInteger(seed) || seed < 1 || seed > entryCount) fail("invalid-source");
      const sourceKey = `entry:${seed}`;
      if (localSources.has(sourceKey)) fail("source-reused");
      localSources.add(sourceKey);
    }
    for (const match of round.matchups) {
      if (
        !/^[a-z][a-z0-9_]*$/.test(match.code) ||
        roundMatches.has(match.code) ||
        previousMatches.has(match.code) ||
        match.format !== "single_game" ||
        match.maxGames !== 1
      ) {
        fail("invalid-matchup");
      }
      roundMatches.add(match.code);
      for (const source of [match.home, match.away]) {
        let sourceKey: string;
        if (source.kind === "entry") {
          if (!Number.isInteger(source.seed) || source.seed < 1 || source.seed > entryCount) {
            fail("invalid-source");
          }
          sourceKey = `entry:${source.seed}`;
        } else if (source.kind === "winner" && !league) {
          // Only earlier rounds can be referenced: excludes forward, self and cyclic edges.
          if (!previousMatches.has(source.matchupCode)) fail("invalid-source");
          sourceKey = `winner:${source.matchupCode}`;
        } else {
          fail("invalid-source");
        }
        if (localSources.has(sourceKey) || (!league && consumedSources.has(sourceKey))) {
          fail("source-reused");
        }
        localSources.add(sourceKey);
        consumedSources.add(sourceKey);
      }
      if (match.home.kind === "entry" && match.away.kind === "entry") {
        const pair = [match.home.seed, match.away.seed].sort((a, b) => a - b).join(":");
        if (pairs.has(pair)) fail("source-reused");
        pairs.add(pair);
      }
      total += 1;
    }
    for (const code of roundMatches) previousMatches.add(code);
  }
  if (total !== (league ? (entryCount * (entryCount - 1)) / 2 : entryCount - 1)) {
    fail("incomplete-structure");
  }
  if (!league) {
    for (let seed = 1; seed <= entryCount; seed += 1) {
      if (!consumedSources.has(`entry:${seed}`)) fail("incomplete-structure");
    }
    const finalMatch = rounds.at(-1)?.matchups[0]?.code;
    for (const code of previousMatches) {
      if (code !== finalMatch && !consumedSources.has(`winner:${code}`)) {
        fail("incomplete-structure");
      }
    }
  }
}
