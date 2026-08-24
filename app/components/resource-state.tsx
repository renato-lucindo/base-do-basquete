import type { ReactNode } from "react";

type ResourceStateKind = "empty" | "error" | "loading";

const defaults: Record<ResourceStateKind, { title: string; detail: string }> = {
  empty: {
    title: "Nada para mostrar",
    detail: "Os dados aparecerão aqui assim que estiverem disponíveis.",
  },
  error: {
    title: "Não foi possível carregar",
    detail: "Tente novamente em alguns instantes.",
  },
  loading: {
    title: "Carregando",
    detail: "Estamos preparando os dados desta página.",
  },
};

export function ResourceState({
  action,
  detail,
  kind,
  title,
}: {
  action?: ReactNode;
  detail?: string;
  kind: ResourceStateKind;
  title?: string;
}) {
  const copy = defaults[kind];
  return (
    <section
      aria-live={kind === "error" ? "assertive" : "polite"}
      className="resource-state"
      data-state={kind}
      role={kind === "error" ? "alert" : "status"}
    >
      {kind === "loading" ? <span aria-hidden="true" className="resource-state-spinner" /> : null}
      <div>
        <h2>{title ?? copy.title}</h2>
        <p>{detail ?? copy.detail}</p>
      </div>
      {action}
    </section>
  );
}
