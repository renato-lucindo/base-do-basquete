import { Link } from "react-router";

import {
  type CompetitionContext,
  contextPath,
  type DetailResource,
  genderDivisionLabel,
  type PublicResource,
} from "../modules/competition/context";
import { PublicFooter } from "./public-navigation";

interface PublicGenderSelectionProps {
  contexts: CompetitionContext[];
  detail?: string;
  resource: PublicResource;
}

export function PublicGenderSelection({ contexts, detail, resource }: PublicGenderSelectionProps) {
  const detailResource = detail === undefined ? null : detailSelectionResource(resource);
  if (detail !== undefined && !detailResource) {
    throw new Error("Public detail selection resource is invalid");
  }

  return (
    <div className="public-shell">
      <main className="public-content public-selection-content">
        <section className="error-card" aria-labelledby="gender-selection-title">
          <p className="eyebrow">Escolha obrigatória</p>
          <h1 id="gender-selection-title">Selecione o naipe da edição</h1>
          <p>
            Há mais de uma edição pública para este ano, série e categoria. Nenhuma opção foi
            escolhida automaticamente.
          </p>
          <div className="admin-actions">
            {contexts.map((context) =>
              context.genderDivision ? (
                <Link
                  className="button button-secondary"
                  key={context.competitionId}
                  to={
                    detail === undefined
                      ? contextPath(context, resource)
                      : contextPath(context, detailResource as DetailResource, detail)
                  }
                >
                  {genderDivisionLabel(context.genderDivision)} · {context.displayName}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="button button-secondary"
                  key={context.competitionId}
                >
                  Naipe em revisão · {context.displayName}
                </span>
              ),
            )}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

export function detailSelectionResource(resource: PublicResource): DetailResource | null {
  return resource === "classificacao" || resource === "visao-geral" ? null : resource;
}
