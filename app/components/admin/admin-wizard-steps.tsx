interface AdminWizardStepsProps {
  current: number;
  labels: readonly string[];
  onSelect?: (step: number) => void;
}

export function AdminWizardSteps({ current, labels, onSelect }: AdminWizardStepsProps) {
  return (
    <nav className="admin-wizard" aria-label="Etapas do fluxo">
      <ol>
        {labels.map((label, index) => {
          const position = index + 1;
          const state =
            position < current ? "Concluída" : position === current ? "Atual" : "Pendente";
          return (
            <li
              key={label}
              data-state={state.toLowerCase()}
              aria-current={position === current ? "step" : undefined}
            >
              <button
                type="button"
                aria-label={`${state}: ${label}`}
                disabled={!onSelect || position > current}
                onClick={() => onSelect?.(position)}
              >
                {position < current ? "✓" : position}
              </button>
              <div>
                <small>{state}</small>
                <strong>{label}</strong>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
