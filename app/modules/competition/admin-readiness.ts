export type CompetitionPrimarySource = "manual_scoresheet" | "fiba_boxscore" | null;

export type CompetitionReadinessStepKey =
  | "teams"
  | "rosters"
  | "schedule"
  | "results"
  | "publication";

export type CompetitionReadinessStepState = "complete" | "current" | "pending";

export interface CompetitionReadinessStep {
  key: CompetitionReadinessStepKey;
  label: string;
  description: string;
  href: string;
  actionLabel: string;
  state: CompetitionReadinessStepState;
}

export interface CompetitionReadinessInput {
  competitionId: number;
  status: string;
  primarySource: CompetitionPrimarySource;
  registrationCount: number;
  draftRegistrationCount: number;
  rosteredRegistrationCount: number;
  gameCount: number;
  finalGameCount: number;
}

export interface CompetitionReadiness {
  steps: CompetitionReadinessStep[];
  next: CompetitionReadinessStep | null;
}

function resultHref(input: CompetitionReadinessInput) {
  if (!input.primarySource) return `/admin/competitions/${input.competitionId}/data-profile`;
  return input.primarySource === "fiba_boxscore"
    ? `/admin/competitions/${input.competitionId}/boxscores/import`
    : `/admin/competitions/${input.competitionId}/scoresheets/new`;
}

export function resolveCompetitionReadiness(
  input: CompetitionReadinessInput,
): CompetitionReadiness {
  const terminal = input.status === "published" || input.status === "archived";
  const teamsComplete =
    terminal || (input.registrationCount > 0 && input.draftRegistrationCount === 0);
  const rostersComplete =
    terminal ||
    (teamsComplete &&
      input.registrationCount > 0 &&
      input.rosteredRegistrationCount >= input.registrationCount);
  const scheduleComplete = terminal || (rostersComplete && input.gameCount > 0);
  const resultsComplete =
    terminal ||
    (scheduleComplete && input.gameCount > 0 && input.finalGameCount === input.gameCount);
  const publicationComplete = terminal;

  const resultAction = input.primarySource
    ? input.primarySource === "fiba_boxscore"
      ? "Importar resultados"
      : "Registrar resultados"
    : "Definir fonte dos jogos";
  const resultDescription = input.primarySource
    ? "Registre os resultados dos jogos cadastrados antes de publicar a edição."
    : "Defina a fonte principal dos jogos antes de registrar resultados.";

  const definitions = [
    {
      key: "teams" as const,
      label: "Equipes",
      description: "Inscreva as equipes e confirme as participações prontas.",
      href: `/admin/competitions/${input.competitionId}#teams`,
      actionLabel: "Revisar equipes",
      complete: teamsComplete,
    },
    {
      key: "rosters" as const,
      label: "Elencos",
      description: "Complete o elenco ativo de cada equipe confirmada.",
      href: `/admin/competitions/${input.competitionId}#rosters`,
      actionLabel: "Revisar elencos",
      complete: rostersComplete,
    },
    {
      key: "schedule" as const,
      label: "Agenda",
      description: "Crie os jogos e organize data, horário e local.",
      href: `/admin/competitions/${input.competitionId}/schedule`,
      actionLabel: "Organizar agenda",
      complete: scheduleComplete,
    },
    {
      key: "results" as const,
      label: "Resultados",
      description: resultDescription,
      href: resultHref(input),
      actionLabel: resultAction,
      complete: resultsComplete,
    },
    {
      key: "publication" as const,
      label: "Publicação",
      description: "Revise a versão pública somente depois de concluir os resultados.",
      href: `/admin/competitions/${input.competitionId}/publication`,
      actionLabel: "Revisar publicação",
      complete: publicationComplete,
    },
  ];

  const firstIncomplete = definitions.findIndex((step) => !step.complete);
  const steps: CompetitionReadinessStep[] = definitions.map((step, index) => ({
    key: step.key,
    label: step.label,
    description: step.description,
    href: step.href,
    actionLabel: step.actionLabel,
    state: step.complete ? "complete" : index === firstIncomplete ? "current" : "pending",
  }));

  return {
    steps,
    next: firstIncomplete === -1 ? null : (steps[firstIncomplete] ?? null),
  };
}
