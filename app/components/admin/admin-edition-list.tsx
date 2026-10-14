import { Link } from "react-router";
import {
  buildEditionNavigation,
  type EditionNavigationItem,
} from "../../modules/competition/admin-edition-navigation";
import type { DisputeNavigationOrder } from "../../modules/competition/edition-workflow";

export const competitionStatusLabels: Record<string, string> = {
  draft: "Rascunho",
  review: "Aguardando validação",
  published: "Publicada",
  archived: "Arquivada",
};

export interface AdminEditionListItem extends EditionNavigationItem {
  id: number;
  display_name: string;
  status: string;
}

export interface AdminEditionListGroup {
  id: string;
  name: string;
  year: number;
  seasonId: number | null;
  navigationOrder: string;
  competitions: AdminEditionListItem[];
}

export function AdminEditionList({ groups }: { groups: AdminEditionListGroup[] }) {
  return (
    <div className="admin-edition-list">
      {groups.map((group) => {
        const { showCategory, showDivision, showGender, ordered, dimensionHeaders } =
          buildEditionNavigation(
            group.competitions,
            group.navigationOrder as DisputeNavigationOrder,
          );
        const headingId = `edition-${group.id}`;
        return (
          <section key={group.id} aria-labelledby={headingId}>
            <h2 id={headingId}>
              {group.name} · {group.year}
            </h2>
            {group.seasonId ? (
              <Link to={`/admin/competitions/new?seasonId=${group.seasonId}`}>
                Adicionar disputa
              </Link>
            ) : null}
            <div className="admin-edition-table-wrap">
              <table className="admin-edition-table" aria-labelledby={headingId}>
                <thead>
                  <tr>
                    {dimensionHeaders.map((label) =>
                      label ? (
                        <th key={label} scope="col">
                          {label}
                        </th>
                      ) : null,
                    )}
                    {showGender ? <th scope="col">Naipe</th> : null}
                    <th scope="col">Disputa</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((item) => {
                    const dimensions =
                      group.navigationOrder === "division_category"
                        ? [
                            showDivision ? (item.divisionLabel ?? "Sem divisão") : null,
                            showCategory ? item.dimensionCategoryName : null,
                          ]
                        : [
                            showCategory ? item.dimensionCategoryName : null,
                            showDivision ? (item.divisionLabel ?? "Sem divisão") : null,
                          ];
                    return (
                      <tr key={item.id}>
                        {dimensions.map((label) =>
                          label ? <td key={`${item.id}-${label}`}>{label}</td> : null,
                        )}
                        {showGender ? (
                          <td>
                            {item.dimensionGender === "male"
                              ? "Masculino"
                              : item.dimensionGender === "female"
                                ? "Feminino"
                                : "Naipe pendente"}
                          </td>
                        ) : null}
                        <td>
                          <Link to={`/admin/competitions/${item.id}`}>{item.display_name}</Link>
                        </td>
                        <td>{competitionStatusLabels[item.status] ?? "Em revisão"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
