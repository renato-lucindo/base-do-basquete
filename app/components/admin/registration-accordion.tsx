import { type ReactNode, useState } from "react";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  confirmed: "Confirmada",
  withdrawn: "Retirada",
  completed: "Concluída",
};

export function RegistrationAccordion({
  id,
  name,
  status,
  playerCount,
  open,
  onToggle,
  roster,
  situation,
  result,
}: {
  id: number;
  name: string;
  status: string;
  playerCount: number;
  open: boolean;
  onToggle: () => void;
  roster: ReactNode;
  situation: ReactNode;
  result: ReactNode;
}) {
  const [section, setSection] = useState("roster");
  const sections = [
    { key: "roster", label: "Elenco", content: roster },
    { key: "situation", label: "Situação", content: situation },
    { key: "result", label: "Resultado", content: result },
  ];
  return (
    <article className="registration-card registration-accordion">
      <h2>
        <button
          className="registration-toggle"
          type="button"
          id={`registration-toggle-${id}`}
          aria-expanded={open}
          aria-controls={`registration-panel-${id}`}
          onClick={onToggle}
        >
          <span aria-hidden="true">{open ? "⌄" : "›"}</span>
          <span>
            <strong>{name}</strong>
            <small>
              {statusLabels[status] ?? "Em revisão"} · {playerCount} atletas ativos
            </small>
          </span>
        </button>
      </h2>
      <section
        id={`registration-panel-${id}`}
        aria-labelledby={`registration-toggle-${id}`}
        hidden={!open}
      >
        <div className="registration-sections">
          {sections.map((item) => (
            <button
              key={item.key}
              type="button"
              className="button button-ghost"
              aria-pressed={section === item.key}
              aria-controls={`registration-${id}-${item.key}`}
              onClick={() => setSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {sections.map((item) => (
          <section
            key={item.key}
            id={`registration-${id}-${item.key}`}
            hidden={section !== item.key}
          >
            <h3>{item.label}</h3>
            {item.content ?? <p>Nenhuma ação disponível nesta situação.</p>}
          </section>
        ))}
      </section>
    </article>
  );
}
