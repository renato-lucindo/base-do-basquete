import type { DisputeNavigationOrder } from "./edition-workflow";

export interface EditionNavigationItem {
  dimensionCategoryName: string;
  dimensionGender: string | null;
  divisionLabel: string | null;
  divisionSortOrder: number | null;
}

export function buildEditionNavigation<T extends EditionNavigationItem>(
  items: T[],
  navigationOrder: DisputeNavigationOrder,
) {
  const categoryNames = new Set(items.map((item) => item.dimensionCategoryName));
  const divisionNames = new Set(items.map((item) => item.divisionLabel ?? "").filter(Boolean));
  const genders = new Set(items.map((item) => item.dimensionGender));
  const showCategory =
    categoryNames.size > 1 || (categoryNames.size === 1 && !categoryNames.has("Adulto"));
  const showDivision =
    divisionNames.size > 1 ||
    (divisionNames.size === 1 && items.some((item) => item.divisionLabel === null));
  const showGender = genders.size > 1;
  const ordered = [...items].sort((left, right) => {
    const category = left.dimensionCategoryName.localeCompare(right.dimensionCategoryName, "pt-BR");
    const division =
      (left.divisionSortOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.divisionSortOrder ?? Number.MAX_SAFE_INTEGER) ||
      (left.divisionLabel ?? "").localeCompare(right.divisionLabel ?? "", "pt-BR");
    const hierarchy =
      navigationOrder === "division_category" ? division || category : category || division;
    return hierarchy || String(left.dimensionGender).localeCompare(String(right.dimensionGender));
  });
  const dimensionHeaders =
    navigationOrder === "division_category"
      ? [showDivision ? "Divisão" : null, showCategory ? "Categoria" : null]
      : [showCategory ? "Categoria" : null, showDivision ? "Divisão" : null];
  return { showCategory, showDivision, showGender, ordered, dimensionHeaders };
}
