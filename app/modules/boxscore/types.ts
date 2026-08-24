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

export interface ParsedBoxscoreTeamStatistics {
  pointsFromTurnovers: number;
  pointsInPaint: number;
  pointsInPaintMade: number;
  pointsInPaintAttempted: number;
  secondChancePoints: number;
  fastBreakPoints: number;
  fastBreakPointsFromTurnovers: number;
  benchPoints: number;
  largestLead: number;
  largestScoringRun: number;
  pointsPerPossession: number;
  timeLeadingSeconds: number;
}

export interface ParsedBoxscoreGameStatistics {
  leadChanges: number;
  timesTied: number;
}

export interface ParsedBoxscoreTeam {
  name: string;
  abbreviation: string;
  score: number;
  periodScores: number[];
  players: ParsedBoxscorePlayer[];
  teamStatistics?: ParsedBoxscoreTeamStatistics;
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
  gameStatistics?: ParsedBoxscoreGameStatistics;
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
