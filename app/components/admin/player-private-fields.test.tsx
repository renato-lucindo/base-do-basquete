import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlayerEligibilitySexField } from "./player-private-fields";

describe("private player eligibility field", () => {
  it("requires an explicit choice without a preselected value", () => {
    const html = renderToStaticMarkup(<PlayerEligibilitySexField editionGender="female" />);

    expect(html).toContain('name="sex"');
    expect(html).toContain("required");
    expect(html).toContain("Selecione sem inferir");
    expect(html).toContain("Naipe da edição: Feminino");
    expect(html).not.toMatch(/<option value="(?:female|male)" selected=""/);
  });

  it("shows the stored value only when the protected edit form supplies it", () => {
    const html = renderToStaticMarkup(<PlayerEligibilitySexField currentValue="male" />);

    expect(html).toContain('<option value="male" selected="">Masculino</option>');
  });
});
