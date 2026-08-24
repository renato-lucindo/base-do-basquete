export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShootingLine {
  made: number;
  attempted: number;
}

export interface ParsedBoxscorePlayer {
  jerseyNumber: string;
  name: string;
  starter: boolean;
  captain: boolean;
  didNotPlay: boolean;
  secondsPlayed: number;
  fieldGoals: ShootingLine;
  twoPoints: ShootingLine;
  threePoints: ShootingLine;
  freeThrows: ShootingLine;
  offensiveRebounds: number;
  defensiveRebounds: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
  foulsCommitted: number;
  foulsReceived: number;
  plusMinus: number;
  efficiency: number;
  points: number;
}

export interface ParsedBoxscoreTeam {
  name: string;
  abbreviation: string;
  score: number;
  periodScores: number[];
  players: ParsedBoxscorePlayer[];
}

export interface ParsedBoxscore {
  format: "FIBA_GENIUS_SPORTS";
  parserVersion: string;
  competitionName: string;
  gameNumber: string;
  scheduledLocal: string;
  durationSeconds: number;
  venue: string;
  teams: [ParsedBoxscoreTeam, ParsedBoxscoreTeam];
  warnings: string[];
}

export interface BoxscoreValidationIssue {
  code: string;
  message: string;
}

export interface BoxscoreValidation {
  valid: boolean;
  issues: BoxscoreValidationIssue[];
}
