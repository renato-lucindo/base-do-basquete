import { describe, expect, it } from "vitest";
import { buildEditionNavigation } from "./admin-edition-navigation";

describe("admin edition navigation", () => {
  it("hides redundant Adulto, division and single-gender levels", () => {
    const result = buildEditionNavigation(
      [
        {
          id: 1,
          dimensionCategoryName: "Adulto",
          dimensionGender: "male",
          divisionLabel: null,
          divisionSortOrder: null,
        },
      ],
      "category_division",
    );
    expect(result).toMatchObject({
      showCategory: false,
      showDivision: false,
      showGender: false,
      dimensionHeaders: [null, null],
    });
  });

  it("orders division before category when the edition requests that hierarchy", () => {
    const result = buildEditionNavigation(
      [
        {
          id: 3,
          dimensionCategoryName: "Sub-17",
          dimensionGender: "female",
          divisionLabel: "Série Prata",
          divisionSortOrder: 2,
        },
        {
          id: 2,
          dimensionCategoryName: "Sub-15",
          dimensionGender: "male",
          divisionLabel: "Série Ouro",
          divisionSortOrder: 1,
        },
      ],
      "division_category",
    );
    expect(result.dimensionHeaders).toEqual(["Divisão", "Categoria"]);
    expect(result.showGender).toBe(true);
    expect(result.ordered.map((item) => item.id)).toEqual([2, 3]);
  });

  it("orders category before division in the default hierarchy", () => {
    const result = buildEditionNavigation(
      [
        {
          id: 2,
          dimensionCategoryName: "Sub-17",
          dimensionGender: "male",
          divisionLabel: "Série Ouro",
          divisionSortOrder: 1,
        },
        {
          id: 1,
          dimensionCategoryName: "Sub-15",
          dimensionGender: "male",
          divisionLabel: "Série Prata",
          divisionSortOrder: 2,
        },
      ],
      "category_division",
    );
    expect(result.dimensionHeaders).toEqual(["Categoria", "Divisão"]);
    expect(result.ordered.map((item) => item.id)).toEqual([1, 2]);
  });
});
